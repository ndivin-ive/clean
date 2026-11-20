# Data model

Source of truth: `src/server/db/schema/` (Drizzle) and the SQL migrations in
`drizzle/`. This document explains intent; it is updated with each schema change.

## Conventions

- Every **tenant table** has `id uuid`, `organization_id uuid`, `created_at`,
  `updated_at`, `created_by`.
- Every tenant table has RLS **enabled and forced**, with one policy:
  `organization_id = current_setting('app.org_id', true)::uuid` for
  SELECT / INSERT / UPDATE / DELETE. No tenant context ⇒ no rows.
- An `AFTER INSERT OR UPDATE OR DELETE` trigger writes `audit_event`
  (actor from `current_setting('app.user_id', true)`).
- **Global identity tables** (no `organization_id`, no business data):
  `user`, `auth_account`, `session`, `verification_token` (decision Q1).

## Tables (Phase 1)

| Table                   | Key columns                                                                                                                                                                | Notes                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| organization            | name, default_language, plan, data_region, ai_setting                                                                                                                      | RLS on its own `id`                  |
| membership              | user_id, roles[], skills[], languages[], regions[], weekly_bookable_hours, manager_id                                                                                      | Q2: `manager_id` defines sales teams |
| invitation              | email, roles[], token_hash, expires_at, accepted_at                                                                                                                        | Q4                                   |
| support_function        | name, description, lead_membership_id, service_rules (JSON)                                                                                                                |                                      |
| support_function_member | support_function_id, membership_id, is_lead                                                                                                                                |                                      |
| engagement_type         | support_function_id, key, name_en, name_fr                                                                                                                                 | Q4                                   |
| request_template        | support_function_id, version, schema (JSON)                                                                                                                                | Immutable once published             |
| scoring_rule_set        | support_function_id, weights, effort_bands, lead_times, flag_rules (JSON)                                                                                                  | See SCORING.md                       |
| account                 | name, country, industry, relationship                                                                                                                                      | new_logo / expand / retain           |
| contact                 | account_id, name, title, decision_role                                                                                                                                     |                                      |
| pipeline_stage          | name_en, name_fr, order, probability, is_won, is_lost                                                                                                                      |                                      |
| opportunity             | account_id, owner_id, name, amount, currency, stage_id, close_date, why_now, next_step, won_lost_reason                                                                    | Q8                                   |
| opportunity_stage_event | opportunity_id, from_stage, to_stage, at                                                                                                                                   | Cycle times                          |
| engagement_request      | opportunity_id, requester_id, support_function_id, template_version, answers, status, readiness_score, readiness_breakdown, effort_points, effort_band, flags, target_date | Q3: `draft` status                   |
| engagement_status_event | request_id, from, to, by, at, note                                                                                                                                         |                                      |
| engagement_assignment   | request_id, user_id                                                                                                                                                        |                                      |
| booking                 | request_id, starts_at, ends_at, location_or_link, external_calendar_ids                                                                                                    | Calendar sync Phase 2                |
| effort_entry            | request_id, user_id, hours, activity, date                                                                                                                                 | prep / delivery / follow_up          |
| engagement_outcome      | request_id, result, notes, deal_impact                                                                                                                                     | 1–5                                  |
| notification            | user_id, kind, payload, read_at                                                                                                                                            | Q4                                   |
| audit_event             | actor_id, entity, entity_id, action, before, after, at                                                                                                                     | Written by trigger                   |

Phase 2/3 tables (`connector`, `ai_provider_setting`) are not created yet.

## Engagement status flow

```
draft → new → needs_information ⇄ (back to new on resubmit)
            → accepted → scheduled → delivered → outcome_recorded
side exits: declined (from new / needs_information), withdrawn (by requester, before delivered)
```

The single transition table lives in `src/domain/engagement/status.ts`
(checkpoint 10) and is tested exhaustively.
