# CLEAN — working notes for Claude Code

@AGENTS.md

## Project

CLEAN is the **seller's own workspace**: a bilingual (EN/FR), multi-tenant
sales companion for account executives and account managers. It ranks what
matters today, prepares every interaction, keeps accounts and relationships
current, and turns notes into updates the seller approves. Brief: `docs/SPEC.md`.
Pivot history: `docs/PIVOT.md`. Decisions: `docs/DECISIONS.md`. Rules:
`docs/RULES.md`. Privacy: `docs/PRIVACY.md`. Use case (industrial profile): `docs/USE_CASE_MECA_INOX.md`. UI direction: iOS-style (D-040),
prototype in `prototype/companion-ios.html`.

## Stack

TypeScript (strict) · Next.js 16 App Router (`src/proxy.ts`, cacheComponents
off) · React 19 · Tailwind 4 · next-intl 4 · PostgreSQL 16 + RLS · Drizzle ORM
· Better Auth (magic link) · Vitest · Playwright · Mailpit.

## Commands

| Task                           | Command                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Start Postgres + Mailpit       | `docker compose up -d` (no Docker: `pnpm db:local`)                                                                 |
| Dev server                     | `pnpm dev` → http://localhost:3000/en                                                                               |
| All static checks + unit tests | `pnpm check`                                                                                                        |
| Type check                     | `pnpm typecheck` (runs `next typegen` first)                                                                        |
| Lint / format                  | `pnpm lint` · `pnpm format`                                                                                         |
| Unit tests                     | `pnpm test`                                                                                                         |
| Integration tests (real DB)    | `pnpm db:migrate --test && pnpm test:integration`                                                                   |
| End-to-end                     | `pnpm test:e2e` (`CI=1` to run against `pnpm build` output; resets the `clean_e2e` DB and starts a local SMTP sink) |
| Migrations                     | `pnpm db:generate` · `pnpm db:migrate`                                                                              |
| Seed demo org                  | `pnpm db:seed`                                                                                                      |

In cloud sandboxes: `pnpm db:local`, then set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` for Playwright.

## Non-negotiable rules (from the brief)

1. Clean-room: write everything here; copy nothing from other repos/employers; invented data only.
2. Multi-tenant and private by default: `organization_id` everywhere; seller records carry `owner_id`; RLS (tenant + owner) + API checks; isolation and privacy tests.
3. Seller owns the record: AI and connectors only propose; nothing is written until the seller approves; every proposal shows its source.
4. Rules first, AI second: every smart feature works without AI; every score and ranking shows its reasons.
5. All AI calls through `src/server/ai/` only (lint-enforced); prompts never include data the user cannot see; no training on customer data.
6. GDPR: opt-in connectors, narrow scopes, no full email storage; see `docs/PRIVACY.md`. Secrets never logged or returned; every write audited.
7. Bilingual EN/FR; no hard-coded UI text (lint blocks JSX literals).
8. Small steps: tests + typecheck + lint green before a checkpoint is done.

**Stop and ask before:** paid services/accounts, stack changes, connecting any
real email/calendar/CRM account, deploying, deleting data or migrations,
starting a new phase.

## Database rules

- All tenant data access goes through `withTenant()` / `withUser()` (`src/server/db/tenant.ts`).
- New tenant table ⇒ in its migration call `SELECT clean_enable_tenant_table('name');`, use `tenantColumns()`, composite FKs (`tenantFk`, `memberFk`), and add it to `TENANT_ONLY_TABLES` in `tests/integration/support/fixtures.ts`.
- New seller-owned table ⇒ `ownedColumns()`, `ownerKey()`, `ownedFk()` to parents, `SELECT clean_enable_owned_table('name');`, and add it to `OWNED_TABLES`. The catalogue test fails otherwise.
- Hand-written SQL goes in a `drizzle-kit generate --custom` migration.

## Code layout

- `src/domain/` — pure logic (scoring, status machine, permissions, templates). No framework/DB imports.
- `src/server/` — DB (`db/`), services, auth, mail, AI gateway. Server-only.
- `src/app/[locale]/` — routes. `src/components/` — UI.
- `tests/unit`, `tests/integration` (real Postgres), `tests/e2e` (Playwright).

## Phase 1 checklist (companion)

Pre-pivot work (support booking, checkpoints 1–2) is summarised in `docs/PIVOT.md`.

- [x] P1. Pivot refactor: docs, new schema and migrations, owner-privacy RLS, feature flags, support module parked
- [x] P2. Sign-in (magic link; Mailpit locally, SMTP sink in e2e), organisations, invitations, roles, team visibility; iOS-style app shell, EN/FR, light/dark
- [x] P3. Rules engine: `rankActions`, `assessDeal`, `assessAccount`, coverage + full unit tests; `docs/RULES.md` (done before P2: pure logic, no external dependency)
- [x] P4. Demo book seed (2 key + 8 accounts, 12 deals, 40 people, 6 months of interactions, signals); Today shows ranked actions (read-only until P7)
- [x] P5. Accounts and people: list (search, tiers, health, next action), account page (health reasons, coverage, relationship map, people, deals, timeline, signals)
- [ ] P6. Deals: board/list, deal page, stakeholders, qualification with evidence, close plan, health reasons
- [ ] P7. Today: ranked actions (do / snooze / dismiss / teach), week-ahead strip
- [ ] P8. Capture: note / paste (voice off by default), rule-based proposals, review and approve
- [ ] P9. Living account plan + review prompt
- [ ] P10. Meeting brief
- [ ] P11. My pipeline and forecast, changes since last week
- [ ] P12. Settings: stages, criteria, cadences, weights, AI provider (off), language, theme
- [ ] P13. "Get help on this deal" behind the `support_requests` flag
- [ ] P14. End-to-end test EN + FR; Phase 1 exit criteria
