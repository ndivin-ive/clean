-- Accept an invitation. The invitee has no membership yet, so they cannot see
-- the invitation under RLS. This SECURITY DEFINER function checks the token
-- hash, expiry, single use and that the signed-in user's email matches, then
-- creates the membership inside that tenant's context.
CREATE OR REPLACE FUNCTION accept_invitation(p_token_hash text, p_user_id uuid)
  RETURNS TABLE (org uuid, reason text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  inv invitation%ROWTYPE;
  user_email text;
BEGIN
  IF p_user_id IS DISTINCT FROM app_current_user() THEN
    RETURN QUERY SELECT NULL::uuid, 'invalid'::text; RETURN;
  END IF;
  SELECT * INTO inv FROM invitation WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, 'invalid'::text; RETURN; END IF;
  IF inv.accepted_at IS NOT NULL THEN RETURN QUERY SELECT NULL::uuid, 'used'::text; RETURN; END IF;
  IF inv.expires_at < now() THEN RETURN QUERY SELECT NULL::uuid, 'expired'::text; RETURN; END IF;
  SELECT email INTO user_email FROM auth_user WHERE id = p_user_id;
  IF lower(user_email) IS DISTINCT FROM lower(inv.email) THEN
    RETURN QUERY SELECT NULL::uuid, 'wrong_email'::text; RETURN;
  END IF;

  PERFORM set_config('app.org_id', inv.organization_id::text, true);
  INSERT INTO membership (organization_id, user_id, roles, created_by)
    VALUES (inv.organization_id, p_user_id, inv.roles, inv.created_by)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET is_active = true;
  UPDATE invitation SET accepted_at = now(), accepted_by = p_user_id WHERE id = inv.id;
  PERFORM set_config('app.org_id', '', true);
  RETURN QUERY SELECT inv.organization_id, NULL::text;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION accept_invitation(text, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION accept_invitation(text, uuid) TO clean_app;
