# Data model (sales companion)

Source of truth: `src/server/db/schema/` (Drizzle) and the migrations in
`drizzle/` (`0000` context functions, `0001` generated schema, `0002` RLS,
owner privacy, audit, grants). The previous model is in git history at `523bdad`.

## Conventions

- **Tenant tables** carry `id`, `organization_id`, `created_at`, `updated_at`, `created_by`; RLS forced; `tenant_isolation` policy; audit and `updated_at` triggers.
- **Seller-owned tables** also carry `owner_id` (defaults to the signed-in user) and four RESTRICTIVE policies: read via `app_can_see_owner(owner_id)`, insert/update/delete only by the owner (D-033).
- **References**: child → parent foreign keys are composite. Tenant tables use `(organization_id, parent_id)`; seller-owned tables use `(organization_id, owner_id, parent_id)` with ON UPDATE CASCADE (D-043). User columns reference `membership (organization_id, user_id)`.
- **Global identity tables** (Better Auth): `auth_user` (with `language`, `theme`), `auth_session` (with `active_organization_id`, D-045), `auth_account`, `auth_verification` (magic-link tokens stored hashed) — no business data, no RLS.
- `accept_invitation(token_hash, user_id)` (migration `0003`) is the only way to join an organisation from an invitation (D-048).
- All access goes through `withTenant()` / `withUser()` (`src/server/db/tenant.ts`).

## Tenant-scoped (organisation settings)

| Table                   | Key columns                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| organization            | name, default_language, plan, data_region, **team_visibility**, fiscal_year_start_month      |
| membership              | user_id, roles (seller / manager / admin / specialist), manager_user_id, is_active           |
| invitation              | email, roles, token_hash (SHA-256), expires_at, accepted_at                                  |
| notification            | user_id, kind, payload, read_at — recipient-only read policy                                 |
| pipeline_stage          | name_en/fr, exit_criterion_en/fr, sort_order, probability, **typical_days**, is_won, is_lost |
| qualification_criterion | key, label_en/fr, help_en/fr, sort_order, required_late                                      |
| role_cadence            | role, days                                                                                   |
| rule_setting            | key, value (weights and thresholds)                                                          |
| feature_flag            | key, enabled                                                                                 |
| ai_provider_setting     | provider (off …), endpoint, encrypted_key (write-only for the app), enabled_features         |

## Seller-owned

| Table                   | Key columns                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| user_rule_adjustment    | rule_key, multiplier (0.4–1)                                                                                                                                |
| account                 | name, domain, country, industry, segment, tier, relationship, annual_value, currency, renewal_date, next_review_date                                        |
| person                  | account_id, name, title, department, email, phone, linkedin_url, notes                                                                                      |
| relationship            | person_id, decision_role, stance, strength (1–5), last_interaction_at, next_touch_due — one per person per owner                                            |
| signal                  | account_id, person_id?, type, title, url, detected_at, source, relevance (1–5)                                                                              |
| account_plan            | account_id (unique), objectives, our_goals, whitespace (JSON), risks (JSON), value_delivered (JSON), next_moves, last_reviewed_at                           |
| deal                    | account_id, name, amount, currency, stage_id, close_date, compelling_event, next_step, next_step_date, forecast_category, won_lost_reason, stage_entered_at |
| deal_stakeholder        | deal_id, person_id, role_in_deal                                                                                                                            |
| deal_qualification      | deal_id, criterion_key, status (unknown / partial / confirmed), evidence, source_interaction_id                                                             |
| deal_event              | deal_id, kind (stage / close_date / forecast / amount / qualification), field, from_value, to_value, occurred_at                                            |
| close_plan_step         | deal_id, title, step_owner (buyer / seller), due_date, done_at, sort_order                                                                                  |
| interaction             | account_id, deal_id?, type, occurred_at (future = scheduled), title, summary, source                                                                        |
| interaction_participant | interaction_id, person_id XOR user_id                                                                                                                       |
| capture_proposal        | batch_id, interaction_id?, kind, entity, entity_id, change (JSON patch), source_kind, source_line, source_excerpt, status, decided_at                       |
| meeting_brief           | interaction_id (unique), content (JSON), generated_by, viewed_at                                                                                            |
| action                  | rule_key, subject_key, fingerprint, account/deal/person ids, title, reason, score, due_at, status, snoozed_until, origin                                    |
| support_request         | deal_id, team, note, status — parked behind flag `support_requests`                                                                                         |

## Audit

`audit_event` (organization_id, actor_id, entity, entity_id, action, before, after, at), written only by the `audit_row()` trigger; secret columns redacted; app role has SELECT only.

## Not yet created

`connector` (Phase 2).
