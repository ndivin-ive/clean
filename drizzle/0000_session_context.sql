-- Session context helpers used by column defaults, RLS policies and the audit
-- trigger. Values are set per transaction by withTenant()/withUser() via
-- set_config(..., is_local => true), so they never leak across pooled
-- connections. Missing or empty ⇒ NULL ⇒ policies match no rows.
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
