-- Row-level security (tenant + owner privacy), audit trail, updated_at and
-- privileges. See docs/PRIVACY.md and docs/DECISIONS.md (D-002, D-003, D-021, D-033).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clean_app') THEN
    RAISE EXCEPTION 'Role clean_app must exist before migrating (see docker/postgres/init.sql)';
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO clean_app;
--> statement-breakpoint

-- ── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint

-- ── audit ───────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: appends to audit_event, which the app role cannot write.
-- Secret columns are stripped before anything is recorded (rule 6).
CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  redacted CONSTANT text[] := ARRAY[
    'token_hash', 'encrypted_credentials', 'encrypted_key',
    'password', 'access_token', 'refresh_token', 'id_token'
  ];
  old_row jsonb;
  new_row jsonb;
  rec jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD) - redacted; END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW) - redacted; END IF;
  IF TG_OP = 'UPDATE' AND (old_row - 'updated_at') = (new_row - 'updated_at') THEN
    RETURN NULL;
  END IF;
  rec := coalesce(new_row, old_row);
  INSERT INTO public.audit_event
    (organization_id, actor_id, entity, entity_id, action, before, after)
  VALUES ((rec ->> 'organization_id')::uuid, app_current_user(), TG_TABLE_NAME,
          (rec ->> 'id')::uuid, lower(TG_OP), old_row, new_row);
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_row() FROM PUBLIC;
--> statement-breakpoint

-- ── owner privacy ───────────────────────────────────────────────────────────
-- Can the current user READ a record owned by `owner`?
--   • always, if they own it;
--   • otherwise only when the organisation has team visibility ON and the
--     viewer is in the owner's management chain, or shares the owner's manager.
-- Admins get no implicit access (D-033). Writes are owner-only (policies below).
CREATE OR REPLACE FUNCTION app_can_see_owner(owner uuid) RETURNS boolean
  LANGUAGE sql STABLE
  SET search_path = pg_catalog, public
  AS $$
  SELECT owner = app_current_user()
    OR (
      EXISTS (SELECT 1 FROM organization o WHERE o.id = app_current_org() AND o.team_visibility)
      AND (
        EXISTS (
          WITH RECURSIVE chain(manager) AS (
            SELECT m.manager_user_id FROM membership m
             WHERE m.organization_id = app_current_org() AND m.user_id = owner
            UNION
            SELECT m.manager_user_id FROM membership m JOIN chain c ON m.user_id = c.manager
             WHERE m.organization_id = app_current_org()
          )
          SELECT 1 FROM chain WHERE manager = app_current_user()
        )
        OR EXISTS (
          SELECT 1 FROM membership a
            JOIN membership b ON b.organization_id = a.organization_id AND b.manager_user_id = a.manager_user_id
           WHERE a.organization_id = app_current_org() AND a.user_id = owner
             AND b.user_id = app_current_user() AND a.manager_user_id IS NOT NULL
        )
      )
    )
$$;
--> statement-breakpoint

-- ── table helpers ───────────────────────────────────────────────────────────
-- Tenant table: RLS enabled + FORCED, tenant_isolation policy, updated_at and
-- audit triggers, DML privileges for the app role.
CREATE OR REPLACE FUNCTION clean_enable_tenant_table(tbl regclass) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s
       USING (organization_id = app_current_org())
       WITH CHECK (organization_id = app_current_org())', tbl);
  EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl);
  EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION audit_row()', tbl);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO clean_app', tbl);
END $$;
--> statement-breakpoint
-- Seller-owned table: everything above, plus RESTRICTIVE owner policies that
-- are AND-ed with tenant_isolation.
CREATE OR REPLACE FUNCTION clean_enable_owned_table(tbl regclass) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM clean_enable_tenant_table(tbl);
  EXECUTE format('CREATE POLICY owner_read ON %s AS RESTRICTIVE FOR SELECT USING (app_can_see_owner(owner_id))', tbl);
  EXECUTE format('CREATE POLICY owner_insert ON %s AS RESTRICTIVE FOR INSERT WITH CHECK (owner_id = app_current_user())', tbl);
  EXECUTE format('CREATE POLICY owner_update ON %s AS RESTRICTIVE FOR UPDATE USING (owner_id = app_current_user()) WITH CHECK (owner_id = app_current_user())', tbl);
  EXECUTE format('CREATE POLICY owner_delete ON %s AS RESTRICTIVE FOR DELETE USING (owner_id = app_current_user())', tbl);
END $$;
--> statement-breakpoint

SELECT clean_enable_tenant_table(t::regclass) FROM unnest(ARRAY[
  'organization', 'membership', 'invitation', 'notification',
  'pipeline_stage', 'qualification_criterion', 'role_cadence', 'rule_setting',
  'feature_flag', 'ai_provider_setting'
]) AS t;
--> statement-breakpoint
SELECT clean_enable_owned_table(t::regclass) FROM unnest(ARRAY[
  'user_rule_adjustment',
  'account', 'person', 'relationship', 'signal', 'account_plan',
  'deal', 'deal_stakeholder', 'deal_qualification', 'deal_event', 'close_plan_step',
  'interaction', 'interaction_participant', 'capture_proposal', 'meeting_brief', 'action',
  'support_request'
]) AS t;
--> statement-breakpoint

-- ── extra read paths (permissive, OR-ed with tenant_isolation) ──────────────
CREATE POLICY membership_self_read ON membership FOR SELECT USING (user_id = app_current_user());
--> statement-breakpoint
CREATE POLICY organization_member_read ON organization FOR SELECT
  USING (id IN (SELECT m.organization_id FROM membership m WHERE m.user_id = app_current_user() AND m.is_active));
--> statement-breakpoint

-- ── personal notifications: only the recipient (RESTRICTIVE) ────────────────
CREATE POLICY notification_recipient ON notification AS RESTRICTIVE FOR SELECT USING (user_id = app_current_user());
--> statement-breakpoint

-- ── AI provider key: write-only for the app (rule 6) ────────────────────────
REVOKE SELECT ON ai_provider_setting FROM clean_app;
--> statement-breakpoint
GRANT SELECT (id, organization_id, created_at, updated_at, created_by, provider, endpoint, enabled_features)
  ON ai_provider_setting TO clean_app;
--> statement-breakpoint

-- ── audit_event: read own tenant only, never written by the app ─────────────
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_read ON audit_event FOR SELECT USING (organization_id = app_current_org());
--> statement-breakpoint
GRANT SELECT ON audit_event TO clean_app;
--> statement-breakpoint

-- ── global identity tables (Better Auth): no tenant data, no RLS ────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_user, auth_session, auth_account, auth_verification TO clean_app;
