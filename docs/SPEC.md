# CLEAN — Product brief: the sales companion

> Source: "CLEAN — Claude Code prompt: pivot to the sales companion", based on
> "CLEAN — The sales companion: research on seller needs and tool gaps"
> (20 Nov 2026) and the first "CLEAN — Product concept & PRD".
> The earlier brief (support booking) is archived in `archive/SPEC-v1-support-booking.md`.
> Decisions taken on this brief's open questions: `DECISIONS.md` (D-031 onwards).

Assumptions: CLEAN starts **standalone** for small teams, with the data model
and sync layer designed so it can later sit on top of HubSpot, Salesforce or
Dynamics. First persona: an account executive or account manager with 5 to 50
active accounts.

## 1. The product

CLEAN is the **seller's own workspace**: a sales companion for account
executives and account managers in B2B companies. It helps them decide what
matters today, prepare for every important interaction, keep accounts and
relationships current, and capture everything without retyping. Manager and
team views are a by-product of the seller's work, never the reason for it.

| Letter | English · Français   | What CLEAN does                                                                                   |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------- |
| C      | Capture · Capter     | Turns meetings, emails and notes into proposed updates the seller approves in one click           |
| L      | Link · Lier          | Links people, accounts, deals and signals: relationship map, coverage gaps, changes               |
| E      | Engage · Engager     | Prepares and runs interactions: meeting brief, questions, debrief, specialist booking             |
| A      | Analyse · Analyser   | Honest view of the seller's own pipeline and accounts: deal health, stalls, forecast with reasons |
| N      | Negotiate · Négocier | Close and grow: close plan, negotiation prep, renewals, expansion whitespace, value delivered     |

Why (research summary): sellers spend only about 40% of their time selling;
sellers overwhelmed by tools are much less likely to hit quota; top performers
prioritise on live signals and research before every contact; won deals involve
about twice as many buyer contacts as lost ones; account plans are seen as
burdensome and are rarely updated. So: **less typing, one place to start the
day, relationship depth made visible, plans that update themselves.**

## 2. Non-negotiable rules

1. **Clean-room build.** Everything is written in this repository. Copy nothing from any other repository or employer system. No real customer data: seed and tests use invented companies and people only.
2. **Multi-tenant and private by default.** Every table has `organization_id`; PostgreSQL row-level security plus API checks; tests prove tenant isolation. Inside a tenant, a seller's accounts are visible to their team only if the admin enables it.
3. **Seller owns the record.** AI and connectors only _propose_ changes. Nothing is written to an account, deal, person or plan until the seller approves. Every proposal shows its source.
4. **Rules first, AI second.** Every smart feature works without AI using transparent rules; AI improves it when a model is connected. Every score and ranking shows its reasons.
5. **Model-agnostic AI.** All AI calls go through one AI gateway module (providers: CLEAN default, Anthropic, OpenAI, Mistral, Azure OpenAI; AI can be switched off). No provider SDK imported elsewhere. Prompts never include data the user cannot see. Customer data is never used for training.
6. **Personal data care (GDPR).** Email and calendar access are opt-in per user, with the narrowest scopes possible; email content is processed to create proposals and not stored in full unless the user keeps it; users can delete their connector data. Lawful basis and retention in `PRIVACY.md`.
7. **Bilingual** English / French from the first screen; no hard-coded user-facing text.
8. **Small, reviewable steps;** tests, type check and lint pass before a checkpoint is called done.

**Stop and ask before:** adding a paid service or account, changing the stack, connecting any real email, calendar or CRM account, deploying anywhere, deleting data or migrations, or starting a new phase.

## 3. Stack

TypeScript (strict), Next.js App Router, Tailwind + headless components, PostgreSQL with RLS and migrations in the repo, Auth (email magic link, Google, Microsoft), i18n `en`/`fr`, Vitest + Playwright, Docker Compose for local dev, seed script. MCP server (official TypeScript SDK) in Phase 3.

## 4. Data model (account-centred)

See `DATA_MODEL.md` for the implemented model. Entities: account, person,
relationship, deal, deal_stakeholder, deal_qualification (default criteria:
metrics, economic buyer, decision criteria, decision process, paper process,
identified pain, champion, competition — each unknown / partial / confirmed with
evidence), interaction, capture_proposal, account_plan, signal, action,
meeting_brief, support_request (parked), ai_provider_setting, connector (Phase 2),
audit_event. Stage changes and qualification changes are stored as events.

## 5. Smart rules (transparent, unit-tested, admin-tunable)

Full logic and defaults: `RULES.md`.

- **5.1 Today ranking** — `rankActions(seller, now)`: candidate actions from rules (next step missing or passed; stalled beyond the stage's typical time; single-threaded above an amount threshold; key criterion unknown late; close within 30 days without forecast category; key person past their cadence; new signal in 7 days; renewal within 90 days without a plan review in 60; meeting tomorrow without a viewed brief; pending capture proposals), scored, top 7 with reasons; done / snooze / dismiss / not relevant (teach). Amount factor = log-scaled share of the seller's open pipeline. Snoozed and dismissed actions return only when their condition changes.
- **5.2 Deal health** — `assessDeal(deal)`: qualification coverage, engaged stakeholders and roles, dated next step, recent buyer interaction, stage age vs typical, close date pushes, compelling event. Healthy ≥ 70, Watch 40–69, At risk < 40.
- **5.3 Account health** — `assessAccount(account)`: coverage of key roles, last executive interaction, open risks, signals, renewal proximity, plan freshness.
- **5.4 Coverage map** — required roles (default: economic buyer, decision maker, champion, technical evaluator, procurement) as filled, weak (strength ≤ 2 or stale) or missing.

## 6. Phases

### Phase 1 — Companion core (current)

1. Pivot refactor; migrations for the new model; realistic demo book (2 key accounts, 8 others, 12 deals, 40 people, 6 months of interactions, signals).
2. Accounts & people: list with tier, health, next action; account page with people, relationship map, deals, timeline, signals.
3. Deals: board and list; deal page with stakeholders, qualification checklist with evidence, close plan steps, health with reasons.
4. Today: ranked actions; done / snooze / dismiss / teach; week-ahead strip.
5. Capture (manual and paste, voice where supported): proposed updates; rules-based extraction first, AI through the gateway when configured; review screen to approve, edit or reject each change.
6. Living account plan with review prompt in Today.
7. Meeting brief from data; AI polishes when available.
8. My pipeline & forecast: commit / best case / pipeline, health and reasons, changes since last week.
9. Settings: stages and typical durations, qualification criteria, role cadences, Today weights, AI provider (off in Phase 1), language.
10. Earlier support-request module reachable from a deal behind a feature flag; not extended.
11. End-to-end test: sign in → Today with reasons → paste notes → approve → deal health and Today change → account plan and next meeting brief. EN and FR.

**Done when** that test passes, the rules have full unit tests, tenant-isolation tests pass, and the demo seed tells a believable story.

### Phase 2 — Connected companion (later)

Google and Microsoft calendar; Gmail and Outlook (opt-in, proposals only); transcript import; signals via RSS / webhooks / CSV; HubSpot two-way sync; Slack / Teams daily digest.

### Phase 3 — Everywhere the seller works (later)

Remote MCP server (read: Today, account summary, deal health, brief; write with confirmation); bring-your-own model; Salesforce and Dynamics sync; optional team view for managers (aggregates only, seller-visible); mobile-first capture.

## 7. UX principles

- The first screen answers "what should I do now, and why?" in under 10 seconds.
- Capture in under 30 seconds after a meeting; approval in one click per change.
- Every number and score can be clicked to see its reasons and data.
- Calm, professional look; one accent colour; light and dark themes; WCAG 2.1 AA; responsive to phone width. Visual direction: iOS-style (D-040).
- No jargon in the UI; methodology terms explained on hover.

## 8. Working agreement

`CLAUDE.md` at the root; `docs/SPEC.md`, `DATA_MODEL.md`, `RULES.md`, `PRIVACY.md`, `DECISIONS.md`, `PIVOT.md`; after each checkpoint a summary of what changed, how to try it and what's next; ask when ambiguous.
