-- Row-level security, audit trail, updated_at maintenance and privileges.
-- See docs/DATA_MODEL.md and docs/DECISIONS.md (D-002, D-003, D-018..D-021).

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
-- SECURITY DEFINER: runs as the migration owner so it can append to
-- audit_event, which the app role cannot write to directly. Secret columns are
-- stripped before anything is recorded (rule 6).
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

  -- Skip no-op updates (only updated_at changed).
  IF TG_OP = 'UPDATE' AND (old_row - 'updated_at') = (new_row - 'updated_at') THEN
    RETURN NULL;
  END IF;

  rec := coalesce(new_row, old_row);
  INSERT INTO public.audit_event
    (organization_id, actor_id, entity, entity_id, action, before, after)
  VALUES (
    (rec ->> 'organization_id')::uuid,
    app_current_user(),
    TG_TABLE_NAME,
    (rec ->> 'id')::uuid,
    lower(TG_OP),
    old_row,
    new_row
  );
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_row() FROM PUBLIC;
--> statement-breakpoint

-- ── tenant table helper ─────────────────────────────────────────────────────
-- Every tenant table gets: RLS enabled + FORCED, the tenant_isolation policy,
-- updated_at + audit triggers, and DML privileges for the app role.
-- New tables in later migrations MUST call this (a test enforces it).
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
  EXECUTE format(
    'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl);
  EXECUTE format(
    'CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION audit_row()', tbl);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO clean_app', tbl);
END $$;
--> statement-breakpoint

SELECT clean_enable_tenant_table(t::regclass) FROM unnest(ARRAY[
  'organization',
  'membership',
  'invitation',
  'notification',
  'support_function',
  'support_function_member',
  'engagement_type',
  'request_template',
  'scoring_rule_set',
  'account',
  'contact',
  'pipeline_stage',
  'opportunity',
  'opportunity_stage_event',
  'engagement_request',
  'engagement_status_event',
  'engagement_assignment',
  'booking',
  'effort_entry',
  'engagement_outcome'
]) AS t;
--> statement-breakpoint

-- ── extra read paths (permissive policies are OR-ed with tenant_isolation) ──
-- A signed-in user can list their own memberships in every organization
-- (organization picker) before choosing a tenant. Read-only.
CREATE POLICY membership_self_read ON membership
  FOR SELECT
  USING (user_id = app_current_user());
--> statement-breakpoint

-- ...and read the organizations they belong to. Read-only.
CREATE POLICY organization_member_read ON organization
  FOR SELECT
  USING (id IN (SELECT m.organization_id FROM membership m
                WHERE m.user_id = app_current_user() AND m.is_active));
--> statement-breakpoint

-- ── audit_event: read own tenant only, never written by the app ─────────────
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_read ON audit_event
  FOR SELECT
  USING (organization_id = app_current_org());
--> statement-breakpoint
GRANT SELECT ON audit_event TO clean_app;
--> statement-breakpoint

-- ── global identity tables (Better Auth): no tenant data, no RLS ────────────
GRANT SELECT, INSERT, UPDATE, DELETE
  ON auth_user, auth_session, auth_account, auth_verification
  TO clean_app;
