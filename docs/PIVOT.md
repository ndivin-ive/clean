# Pivot: from support booking to the sales companion

Pivot approved on 20 Nov 2026. State before the pivot: commit `523bdad`
(checkpoints 1–2 of the support-booking build plus prototypes). Nothing had been
deployed and no real data existed, so the schema baseline was replaced (D-041).

## Kept as is

| Item                                                                                                                                | Why                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Scaffold: Next.js 16, strict TS, Tailwind 4, next-intl, lint guard rails, CI, Docker Compose, `scripts/local-pg.sh`                 | Product-agnostic foundation, already tested          |
| Tenancy core: `organization`, `membership`, `invitation`, `notification`, `auth_*`, `audit_event`                                   | Same multi-tenant model                              |
| RLS machinery: context functions, `withTenant` / `withUser`, table helper, tenant-safe composite FKs, audit trigger                 | Same security model, now extended with owner privacy |
| Test harness (catalogue, isolation, audit)                                                                                          | Rewritten fixtures, same approach                    |
| AI gateway boundary, Better Auth choice                                                                                             | Unchanged requirements                               |
| Decisions D-026 (stages with exit criteria + typical time), D-027 (stage bars, not a funnel), D-029 (conversion from stored events) | Still valid for the seller's pipeline                |

## Refactored

| Before                                         | After                                                                                                    | Why                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `account`                                      | adds domain, segment, tier, prospect/customer, annual value, renewal and review dates; owned by a seller | Account-centred companion                            |
| `contact`                                      | `person` + `relationship` (seller's view: role, stance, strength, last touch)                            | Relationship depth is the product                    |
| `opportunity`                                  | `deal` with compelling event, dated next step, forecast category                                         | Brief §4                                             |
| `opportunity_stage_event`                      | `deal_event` (stage, close date, forecast, amount, qualification)                                        | Trends, stalls, pushes and weekly changes from facts |
| `pipeline_stage`                               | adds exit criteria and typical days                                                                      | Stalled-deal rule                                    |
| Roles AE / manager / specialist / lead / admin | seller / manager / admin (+ specialist for the parked module)                                            | D-032                                                |
| Role scoping only in the app layer (Q5)        | Owner privacy enforced in PostgreSQL with restrictive policies                                           | Rule 2, D-033                                        |

## Removed or parked

| Item                                                                                                                                                                             | Status                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 11 support-booking tables (support functions, members, engagement types, request templates, scoring rule sets, requests, status events, assignments, bookings, effort, outcomes) | Removed. Collapsed into one `support_request` table behind the `support_requests` flag (D-031). Design kept in git history at `523bdad` |
| Readiness scoring (`SCORING.md`)                                                                                                                                                 | Archived in `docs/archive/`                                                                                                             |
| Old brief                                                                                                                                                                        | Archived in `docs/archive/SPEC-v1-support-booking.md`                                                                                   |
| Prototype v4 (support booking, manager dashboards)                                                                                                                               | Moved to `prototype/archive/`                                                                                                           |
| Manager dashboard and manager "push an action" (D-028)                                                                                                                           | Parked; team view returns in Phase 3 as aggregates only                                                                                 |
