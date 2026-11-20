# CLEAN — working notes for Claude Code

@AGENTS.md

## Project

CLEAN is a lightweight, bilingual (EN/FR), multi-tenant B2B CRM: pipeline
(accounts, opportunities), booking of specialist support against deals, and
process analytics. Full brief: `docs/SPEC.md`. Decisions: `docs/DECISIONS.md`.

## Stack

TypeScript (strict) · Next.js 16 App Router (`src/proxy.ts`, cacheComponents
off) · React 19 · Tailwind 4 · next-intl 4 · PostgreSQL 16 + RLS · Drizzle ORM
· Better Auth (checkpoint 3) · Vitest · Playwright · Mailpit.

## Commands

| Task                           | Command                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| Start Postgres + Mailpit       | `docker compose up -d` (no Docker: `pnpm db:local`)         |
| Dev server                     | `pnpm dev` → http://localhost:3000/en                       |
| All static checks + unit tests | `pnpm check`                                                |
| Type check                     | `pnpm typecheck` (runs `next typegen` first)                |
| Lint / format                  | `pnpm lint` · `pnpm format`                                 |
| Unit tests                     | `pnpm test`                                                 |
| Integration tests (real DB)    | `pnpm db:migrate --test && pnpm test:integration`           |
| End-to-end                     | `pnpm test:e2e` (`CI=1` to run against `pnpm build` output) |
| Migrations                     | `pnpm db:generate` · `pnpm db:migrate`                      |
| Seed demo org                  | `pnpm db:seed`                                              |

In cloud sandboxes: `pnpm db:local`, then set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` for Playwright.

## Non-negotiable rules (from the brief)

1. Clean-room: write everything here; copy nothing from other repos/employers.
2. Multi-tenant: `organization_id` everywhere; RLS + API checks; isolation tests.
3. Bilingual: every UI string via next-intl (`messages/en.json`, `messages/fr.json`). Lint blocks JSX literals.
4. Rules first, AI second: every smart feature works without AI; AI only suggests; scores show why.
5. All AI calls through `src/server/ai/` only (lint-enforced).
6. Secrets encrypted at rest, never logged/returned; every write audited.
7. EU-first hosting; no customer data for training.
8. Small steps: tests + typecheck + lint green before a checkpoint is done.

**Stop and ask before:** paid services/accounts, stack changes, deploying,
sending real email, deleting data/migrations, starting a new phase.

## Database rules

- All tenant data access goes through `withTenant()` / `withUser()` (`src/server/db/tenant.ts`).
- New tenant table ⇒ in its migration call `SELECT clean_enable_tenant_table('name');`, use `tenantColumns()`, composite FKs (`tenantFk`, `memberFk`), and add it to `TENANT_TABLES` in `tests/integration/support/fixtures.ts`. The catalogue test fails otherwise.
- Hand-written SQL goes in a `drizzle-kit generate --custom` migration.

## Code layout

- `src/domain/` — pure logic (scoring, status machine, permissions, templates). No framework/DB imports.
- `src/server/` — DB (`db/`), services, auth, mail, AI gateway. Server-only.
- `src/app/[locale]/` — routes. `src/components/` — UI.
- `tests/unit`, `tests/integration` (real Postgres), `tests/e2e` (Playwright).

## Phase 1 checklist

- [x] 1. Scaffold: strict TS, lint, format, i18n EN/FR, Docker Compose, Drizzle, Vitest, Playwright, CI, docs
- [x] 2. Schema, RLS policies, audit trigger, tenant-isolation tests
- [ ] 3. Auth (magic link), organizations, invitations, roles, `can()` matrix
- [ ] 4. Setup wizard (language, stages, first support function, invites)
- [ ] 5. Accounts, contacts, opportunities; stages; Kanban + list; CSV import
- [ ] 6. Support functions admin (members, skills, hours, engagement types, service rules)
- [ ] 7. Template engine + 4 starter templates + versioned editor
- [ ] 8. `assess()` rules engine + tests + SCORING.md
- [ ] 9. "Get help on this deal", live score panel, autosaved drafts, My requests
- [ ] 10. Triage queue, status machine, history, notifications, email (Mailpit)
- [ ] 11. Effort and outcome logging
- [ ] 12. E2E full loop in EN + FR; realistic demo seed
