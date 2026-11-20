# CLEAN — Claude Code build prompt

> How to use: create an empty private GitHub repository (for example `clean-app`), open it in Claude Code, and paste everything below the line as your first message. Claude Code will plan Phase 1, wait for your approval, then build.
>
> Source: "CLEAN — Product concept & PRD" (draft v0.1, 20 Nov 2026).

---

You are the lead engineer for **CLEAN**, a new SaaS product. Read this whole brief before doing anything. Then reply with (1) a short restatement of what you will build in Phase 1, (2) the proposed repository structure, (3) a numbered implementation plan with checkpoints, and (4) any questions. **Do not write code until I approve the plan.**

## 1. Product in one paragraph

CLEAN is a lightweight, bilingual (English / French) CRM for small B2B companies (20–200 people) where account executives sell with the help of specialist teams: presales, solution architects, value advisors, customer success, partner desks. It brings three jobs into one place: the **pipeline** (accounts and opportunities), the **booking** of specialist support against those opportunities, and **analytics** on how the process performs. The name is the process: **C**apture / Capter · **L**ink / Lier · **E**ngage / Engager · **A**nalyse / Analyser · **N**egotiate / Négocier.

## 2. Non-negotiable rules

1. **Clean-room build.** Write everything from scratch in this repository. Do not copy code, text, templates, names or data from any other repository or employer system (in particular nothing from `gva-engagement-request` or Equinix). The behaviour described in this brief is the only spec.
2. **Multi-tenant from day one.** Every table has `organization_id`; isolation enforced with PostgreSQL row-level security, plus checks in the API layer. Write tests that prove one tenant cannot read another's data.
3. **Bilingual.** All UI strings go through i18n (English and French) from the first screen. No hard-coded user-facing text.
4. **Rules first, AI second.** Every smart feature must work with transparent rules and no AI. AI only drafts or suggests; a user always confirms before anything is saved. Scores always show why.
5. **Model-agnostic AI.** All AI calls go through one internal AI gateway module. No provider SDK is imported anywhere else.
6. **Security basics.** Secrets and customer API keys encrypted at rest, never logged, never returned after entry. Every write is recorded in an audit table.
7. **EU-first.** Assume hosting and database in an EU region; no customer data used for model training.
8. **Small, reviewable steps.** One checkpoint at a time; run tests and type checks before saying a step is done; commit with clear messages.

**Stop and ask me before:** adding a paid service or account, changing the stack below, deploying anywhere, sending real emails, deleting data or migrations, or starting a new phase.

## 3. Stack (proposed — challenge it in your plan if you see a better option)

| Layer     | Choice                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Language  | TypeScript everywhere, strict mode                                                                    |
| Web app   | Next.js (App Router), React, Tailwind CSS, a headless component library (shadcn/ui or similar)        |
| Database  | PostgreSQL with row-level security; migrations in the repo (Drizzle or Prisma — pick one and justify) |
| Auth      | Email magic link + Google + Microsoft sign-in (Auth.js or equivalent); SSO later                      |
| i18n      | `next-intl` or equivalent, `en` and `fr`                                                              |
| Tests     | Vitest for units, Playwright for end-to-end                                                           |
| Local dev | Docker Compose for Postgres and a local mail catcher; seed script with a demo organisation            |
| MCP       | Official MCP TypeScript SDK, remote server (Streamable HTTP), OAuth per user — Phase 3                |

## 4. Users, roles and permissions

Five fixed roles plus admin-defined **support functions**. A user can hold several roles.

| Capability                                      | Account executive | Sales manager | Specialist           | Support team lead             | Admin |
| ----------------------------------------------- | ----------------- | ------------- | -------------------- | ----------------------------- | ----- |
| Create / edit own accounts and opportunities    | Yes               | Yes           | No                   | No                            | Yes   |
| See pipeline                                    | Own deals         | Their team    | Deals they support   | Deals their function supports | All   |
| Request support on a deal                       | Yes               | Yes           | Yes                  | Yes                           | Yes   |
| Triage, accept, decline, reassign               | No                | No            | Own queue if allowed | Their function                | All   |
| Log effort and outcome                          | Outcome only      | Outcome only  | Yes                  | Yes                           | Yes   |
| Set own availability and skills                 | Yes               | Yes           | Yes                  | Yes (their team)              | Yes   |
| Analytics                                       | Own               | Team          | Own                  | Function                      | All   |
| Configure stages, functions, templates, scoring | No                | No            | No                   | Their function's template     | Yes   |
| Users, billing, integrations                    | No                | No            | No                   | No                            | Yes   |

A **support function** has: name, description, lead, members (skills, languages, regions, weekly bookable hours), engagement types offered (discovery call, demo, workshop, business case, executive briefing, proof of concept, onboarding review), a request template, scoring rules and service rules (who may request, approval required or not, target response time, max open requests per specialist).

## 5. Data model (starting point)

All tables: `id` (UUID), `organization_id`, `created_at`, `updated_at`, `created_by`.

- **organization**: name, default language, plan, data region, AI setting
- **user** / **membership**: name, email, language, roles[], skills[], languages[], regions[], weekly_bookable_hours
- **support_function**, **support_function_member** (user, is_lead)
- **request_template**: support_function_id, version, schema (JSON: sections → fields with key, label_en, label_fr, type, required, options, hint)
- **scoring_rule_set**: support_function_id, weights (JSON), effort_bands (JSON), lead_times (JSON), flag_rules (JSON)
- **account**: name, country, industry, relationship (new_logo | expand | retain)
- **contact**: account_id, name, title, decision_role (decision_maker | sponsor | influencer | technical_evaluator | procurement | unknown)
- **pipeline_stage**: name_en, name_fr, order, probability, is_won, is_lost
- **opportunity**: account_id, owner_id, name, amount, currency, stage_id, close_date, why_now, next_step, won_lost_reason
- **opportunity_stage_event**: opportunity_id, from_stage, to_stage, at (for cycle times)
- **engagement_request**: opportunity_id, requester_id, support_function_id, template_version, answers (JSON), status, readiness_score, readiness_breakdown (JSON), effort_points, effort_band, flags (JSON), target_date
- **engagement_status_event**: request_id, from, to, by, at, note
- **engagement_assignment**: request_id, user_id
- **booking**: request_id, starts_at, ends_at, location_or_link, external_calendar_ids (JSON)
- **effort_entry**: request_id, user_id, hours, activity (prep | delivery | follow_up), date
- **engagement_outcome**: request_id, result (decision | next_step | qualified_out | no_progress), notes, deal_impact (1–5)
- **connector**: scope (org | user), type, encrypted_credentials, status, last_sync_at — Phase 2
- **ai_provider_setting**: provider, endpoint, encrypted_key, enabled_features[] — Phase 3
- **audit_event**: actor_id, entity, entity_id, action, before (JSON), after (JSON), at

Engagement status flow: `new → needs_information → accepted → scheduled → delivered → outcome_recorded`, with side exits `declined` and `withdrawn`. Enforce allowed transitions in one place and test them.

## 6. Smart request form and scoring (rules engine)

The request form is rendered entirely from the template JSON (sections, fields, validation, summary and detail views all derive from it). Ship **four starter templates**: Presales demo / discovery, Strategic workshop or executive briefing, Business case review, Customer success review. Write their wording yourself; keep them generic.

Implement a pure, unit-tested function `assess(request, ruleSet, today) → { score, breakdown[], effortPoints, effortBand, workingDaysToTarget, flags[] }`:

- **Readiness score (0–100)** as a weighted sum of configurable criteria, defaults:
  - clear objective (text length / presence of an outcome statement): up to 15
  - concrete success criteria (who commits to what): up to 15
  - at least one expected outcome selected: 5
  - named customer attendees with titles: 15; at least one decision maker or sponsor: +5
  - most senior attendee level given: 5
  - account plan status (documented or formal > informal > none): up to 10
  - linked opportunity or stage beyond "no opportunity": 5
  - customer's own topics described: up to 10
  - follow-up owner described: 5
  - lead time vs the effort band's required lead time: up to 10
- **Effort points** from engagement type, duration, role requested (lead / co-present / content only / coach), deliverables and extras (for example a site visit or a C-level audience); mapped to configurable **bands** (Light, Standard, Significant, Major), each with a typical effort and a minimum lead time in working days.
- **Flags** (coaching hints shown to the requester as they type), for example: date closer than the band's lead time; strategic session with no senior attendee; no decision maker named; no account plan for a customer-facing session; high effort with no opportunity; date not confirmed with the customer; mostly technical session (suggest the technical function).
- Labels: ≥ 75 "Ready for triage", 50–74 "Workable, some gaps", < 50 "Needs more detail" (translated).
- All weights, bands, lead times and flag rules are read from `scoring_rule_set`, editable by admins, with defaults seeded.

The form shows the live score, the breakdown (which criteria passed / failed) and the flags in a side panel while the user types. Drafts autosave.

## 7. Phases (build only Phase 1 now)

### Phase 1 — Core loop (this session's scope)

1. Repo scaffold, lint, format, strict TS, CI (type check + tests), Docker Compose, seed data, README.
2. Auth, organisation creation, invitations, roles; setup wizard (language, pipeline stages, first support function, invite users).
3. RLS policies and tenant-isolation tests.
4. Accounts, contacts, opportunities; configurable stages; Kanban and list views; CSV import for accounts and opportunities.
5. Support functions admin: members, skills, bookable hours, engagement types, service rules.
6. Template engine + four starter templates; template editor (admin) with versioning.
7. Rules engine `assess()` with full unit tests; live score panel in the form.
8. "Get help on this deal" from any opportunity → request; My requests view.
9. Triage queue per function: filter, accept, decline (reason), ask for information, reassign; status history; in-app notifications and email via the local mail catcher.
10. Effort and outcome logging after delivery.
11. End-to-end test of the full loop: AE creates deal → requests help → lead accepts and assigns → specialist logs effort and outcome → request shows `outcome_recorded`.

**Phase 1 is done when** that end-to-end test passes in both languages, tenant-isolation tests pass, and the demo seed shows a realistic organisation.

### Phase 2 — Booking and analytics (later)

Google and Microsoft 365 calendar connectors (availability, holds, invites); Slack and Teams notifications with accept/decline actions; webhooks and REST API (OpenAPI spec); analytics v1: demand vs capacity per function and week, utilisation (team-level by default, individual visibility admin-controlled), request quality trend, request-to-accepted time, win rate / cycle time / deal size with vs without support, stalled deals.

### Phase 3 — Pilot features (later)

- **Remote MCP server**: read tools (my requests, request status, function availability, opportunity summary) and two write tools (create request, log outcome); runs as the signed-in user with their permissions; writes require confirmation. Must work as a Microsoft Copilot Studio MCP tool and as a Claude custom connector (publicly reachable HTTPS, OAuth).
- **AI gateway and bring-your-own model**: providers = CLEAN default, Anthropic, OpenAI, Mistral, Azure OpenAI (later AWS Bedrock, Google Vertex AI), or AI off. Per-call log (feature, model, user, tokens). Prompts never include data the user cannot see.
- Two AI features: prep brief for the specialist; outcome and next-steps draft from notes or a transcript, for the specialist to confirm.

### Phase 4 — Launch v1 (later)

Public sign-up, billing (Free / Team / Business plans), CRM sync (HubSpot first), marketing site in EN/FR.

## 8. UX principles

- Small-team simple: a new organisation is usable within 15 minutes of sign-up.
- Every screen answers "what do I do next?" for its role.
- Accessible (WCAG 2.1 AA), keyboard-friendly, responsive down to phone width, light and dark themes.
- Calm, professional visual style; one accent colour; no clutter.

## 9. Working agreement

- Keep a `CLAUDE.md` at the repo root with: project summary, stack, commands, these rules, and the current phase checklist. Update the checklist as you go.
- Keep `docs/` with `SPEC.md` (this brief), `DATA_MODEL.md`, `SCORING.md` and `DECISIONS.md` (one line per technical decision with the reason).
- Before each checkpoint is marked done: tests, type check and lint pass; summarise what changed and what to try.
- If something in this brief is ambiguous or contradictory, ask instead of guessing.

Start now with the plan for Phase 1 only.
