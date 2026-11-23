# UAT prototype

`clean-uat.html` is a single-file, clickable prototype of the Phase 1 screens,
used for user acceptance review before decisions on authentication and roles.

- Demo data only (invented organisation "Lumen Data SAS"); changes stay in the
  browser tab. No backend, no real sign-in, no email.
- Five roles via "View as", English/French toggle, review notes toggle.
- The readiness score uses the brief's default weights (§6) as a preview; the
  production rules engine is built and unit-tested in checkpoint 8.
- Not part of the Next.js app, not linted, not deployed. It will be retired
  once the real app reaches feature parity.

## Companion prototype (pivot)

`companion-ios.html` is the clickable prototype for the pivot to the sales
companion, in an iOS-style layout (large titles, inset grouped lists, bottom
tab bar on phones, floating top tab bar on wide screens, bottom sheets).
It implements the Today ranking (brief §5.1), deal and account health
(§5.2–5.3), coverage, rule-based capture with approval, the living account
plan, the meeting brief and the pipeline/forecast view on invented demo data.
No Apple trademarks, logos or SF Symbols are used; icons are drawn for it.
`clean-uat.html` is the earlier support-booking prototype, kept for reference
(`archive/clean-uat-v4.html`).

### Workspaces (Meca-Inox use case)

Settings → Workspace switches between two invented demo organisations:
**Lumen Data (demo)** (generic B2B profile, blue) and **Meca-Inox (démo)**
(industrial equipment profile, French, red `#EC001B` accent and navy
`#233044` brand mark from the public site meca-inox-valves.com; colours only,
no logo). The Meca-Inox data (`MECA_RAW`) is generated from
`src/server/seed/meca-inox-data.ts` and the industrial profile, so the
prototype ranks the same seven Today actions as the app. See
`docs/USE_CASE_MECA_INOX.md`.

### UAT prototype: Meca-Inox organisation

`archive/clean-uat-v4.html` has an **Organisation** selector in the top bar:
Lumen Data SAS or **Meca-Inox (démo)**. The Meca-Inox organisation uses the
industrial stages, red accent and navy brand mark, and the support teams of a
valve maker: applications and presales, engineering office, quoting and sales
administration, quality and certification, testing laboratory, large custom
valves (group plant in Spain). Each team has its own request form and
engagement types (technical visit, bench demonstration, 3D drawings,
PED/ATEX/3.1 pack, supplier audit, test campaign, large valve review). All
users, customers, deals and requests are invented.
