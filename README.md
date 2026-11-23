# CLEAN

A lightweight, bilingual (English / French) CRM for small B2B companies where
account executives sell with the help of specialist teams. **C**apture ·
**L**ink · **E**ngage · **A**nalyse · **N**egotiate.

> Status: Phase 1 in development. See `CLAUDE.md` for the checklist.

## Quick start

Requirements: Node.js ≥ 20.9 (22 recommended), pnpm 10, Docker (or a local
PostgreSQL 16).

```bash
pnpm install
cp .env.example .env
docker compose up -d        # PostgreSQL 16 + Mailpit (http://localhost:8025)
pnpm db:migrate
pnpm db:seed                # invented demo organisations "Lumen Data (demo)" and "Meca-Inox (démo)"
pnpm dev                    # http://localhost:3000/en  ·  /fr
```

Sign in with `camille.martin@lumendata.example` (seller with the demo book),
`sarah.okafor@lumendata.example` (manager) or `hugo.bernard@lumendata.example`
(admin); the magic link arrives in Mailpit at http://localhost:8025.

No Docker? `pnpm db:local` starts a throwaway PostgreSQL 16 with the same
roles and databases.

## Checks

```bash
pnpm check          # typecheck + lint + format + unit tests
pnpm test:e2e       # Playwright (English and French)
```

## Documentation

- `docs/SPEC.md` — product brief (Phase 1–4)
- `docs/DATA_MODEL.md` — tables, RLS and audit conventions
- `docs/SCORING.md` — readiness score, effort bands, flags
- `docs/DECISIONS.md` — technical decisions and why

## Security model (summary)

The app connects to PostgreSQL as `clean_app`, a role that owns no tables and
cannot bypass row-level security. Each request runs in a transaction with the
tenant set via `set_config('app.org_id', …, true)`; every tenant table's policy
filters on it. Migrations run as `clean_owner`.
