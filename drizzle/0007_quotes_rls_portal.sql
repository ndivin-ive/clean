-- Quotes (D-060): row-level security, immutability once sent, and the two
-- narrow entry points used by the customer page.

SELECT clean_enable_owned_table('quote');
--> statement-breakpoint
SELECT clean_enable_owned_table('quote_line');
--> statement-breakpoint
SELECT clean_enable_tenant_table('quote_sequence');
--> statement-breakpoint

-- A sent quote is a document the customer may accept: its content can no
-- longer change. Only the lifecycle columns move, along allowed transitions.
CREATE OR REPLACE FUNCTION quote_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF (NEW.title, NEW.number, NEW.revision, NEW.language, NEW.currency, NEW.valid_until,
        NEW.introduction, NEW.terms, NEW.recipient_name, NEW.recipient_email,
        NEW.subtotal, NEW.vat_total, NEW.total, NEW.seller_snapshot, NEW.deal_id,
        NEW.account_id, NEW.sent_at)
       IS DISTINCT FROM
       (OLD.title, OLD.number, OLD.revision, OLD.language, OLD.currency, OLD.valid_until,
        OLD.introduction, OLD.terms, OLD.recipient_name, OLD.recipient_email,
        OLD.subtotal, OLD.vat_total, OLD.total, OLD.seller_snapshot, OLD.deal_id,
        OLD.account_id, OLD.sent_at) THEN
      RAISE EXCEPTION 'quote % is %, its content cannot change', OLD.id, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  -- The customer link can be replaced (new token) only while the quote awaits an answer.
  IF NEW.token_hash IS DISTINCT FROM OLD.token_hash
     AND NOT (OLD.status = 'draft' OR (OLD.status = 'sent' AND NEW.status = 'sent')) THEN
    RAISE EXCEPTION 'the link of a % quote cannot change', OLD.status USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status = 'sent')
    OR (OLD.status = 'sent' AND NEW.status IN ('accepted', 'declined', 'superseded'))
    OR (OLD.status = 'declined' AND NEW.status = 'superseded')
  ) THEN
    RAISE EXCEPTION 'quote % cannot go from % to %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quote_guard BEFORE UPDATE ON quote FOR EACH ROW EXECUTE FUNCTION quote_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION quote_line_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  st quote_status;
BEGIN
  SELECT status INTO st FROM quote WHERE id = coalesce(NEW.quote_id, OLD.quote_id);
  IF st IS NOT NULL AND st <> 'draft' THEN
    RAISE EXCEPTION 'lines of a % quote cannot change', st USING ERRCODE = 'check_violation';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER quote_line_guard BEFORE INSERT OR UPDATE OR DELETE ON quote_line
  FOR EACH ROW EXECUTE FUNCTION quote_line_guard();
--> statement-breakpoint

-- Customer page: read one sent quote by the hash of its link token. The
-- customer has no account, so RLS cannot apply; this function returns only
-- what the document shows (no internal ids, owner or deal data) and records
-- the first view.
CREATE OR REPLACE FUNCTION quote_by_token(p_token_hash text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  q quote%ROWTYPE;
  result jsonb;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN RETURN NULL; END IF;
  SELECT * INTO q FROM quote WHERE token_hash = p_token_hash;
  IF NOT FOUND OR q.status = 'draft' THEN RETURN NULL; END IF;
  IF q.status = 'superseded' THEN
    RETURN jsonb_build_object('status', 'superseded', 'language', q.language);
  END IF;
  PERFORM set_config('app.org_id', q.organization_id::text, true);
  IF q.viewed_at IS NULL THEN
    UPDATE quote SET viewed_at = now() WHERE id = q.id;
  END IF;
  SELECT jsonb_build_object(
    'status', q.status, 'number', q.number, 'revision', q.revision, 'title', q.title,
    'language', q.language, 'currency', q.currency, 'validUntil', q.valid_until,
    'introduction', q.introduction, 'terms', q.terms, 'recipientName', q.recipient_name,
    'subtotal', q.subtotal, 'vatTotal', q.vat_total, 'total', q.total,
    'seller', q.seller_snapshot, 'sentAt', q.sent_at, 'respondedAt', q.responded_at,
    'responderName', q.responder_name, 'responderTitle', q.responder_title,
    'declineReason', q.decline_reason,
    'customer', (SELECT a.name FROM account a WHERE a.id = q.account_id),
    'lines', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'description', l.description, 'quantity', l.quantity, 'unit', l.unit,
        'unitPrice', l.unit_price, 'discountPct', l.discount_pct, 'vatRate', l.vat_rate)
        ORDER BY l.sort_order, l.created_at)
      FROM quote_line l WHERE l.quote_id = q.id), '[]'::jsonb)
  ) INTO result;
  PERFORM set_config('app.org_id', '', true);
  RETURN result;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION quote_by_token(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION quote_by_token(text) TO clean_app;
--> statement-breakpoint

-- Customer page: accept or decline a sent, unexpired quote. The quote owner
-- is notified; the deal itself is NOT changed (rule 3: the seller decides).
CREATE OR REPLACE FUNCTION respond_to_quote(
  p_token_hash text, p_decision text, p_name text, p_title text, p_reason text)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  q quote%ROWTYPE;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN RETURN 'invalid'; END IF;
  IF p_decision NOT IN ('accepted', 'declined') THEN RETURN 'invalid'; END IF;
  SELECT * INTO q FROM quote WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR q.status = 'draft' THEN RETURN 'invalid'; END IF;
  IF q.status <> 'sent' THEN RETURN 'closed'; END IF;
  IF q.valid_until < current_date THEN RETURN 'expired'; END IF;
  IF v_name IS NULL OR length(v_name) > 120 THEN RETURN 'name_required'; END IF;
  IF length(coalesce(p_title, '')) > 120 OR length(coalesce(p_reason, '')) > 2000 THEN RETURN 'invalid'; END IF;

  PERFORM set_config('app.org_id', q.organization_id::text, true);
  UPDATE quote SET status = p_decision::quote_status, responded_at = now(),
    responder_name = v_name, responder_title = nullif(btrim(coalesce(p_title, '')), ''),
    decline_reason = CASE WHEN p_decision = 'declined' THEN nullif(btrim(coalesce(p_reason, '')), '') END
  WHERE id = q.id;
  INSERT INTO notification (organization_id, user_id, kind, payload)
    VALUES (q.organization_id, q.owner_id, 'quote.' || p_decision,
            jsonb_build_object('quoteId', q.id, 'number', q.number, 'revision', q.revision, 'title', q.title));
  PERFORM set_config('app.org_id', '', true);
  RETURN 'ok';
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION respond_to_quote(text, text, text, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION respond_to_quote(text, text, text, text, text) TO clean_app;
