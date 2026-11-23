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
`clean-uat.html` is the earlier support-booking prototype, kept for reference.

### Workspaces (Meca-Inox use case)

Settings → Workspace switches between two invented demo organisations:
**Lumen Data (demo)** (generic B2B profile, blue) and **Meca-Inox (démo)**
(industrial equipment profile, French, red `#EC001B` accent and navy
`#233044` brand mark from the public site meca-inox-valves.com; colours only,
no logo). The Meca-Inox data (`MECA_RAW`) is generated from
`src/server/seed/meca-inox-data.ts` and the industrial profile, so the
prototype ranks the same seven Today actions as the app. See
`docs/USE_CASE_MECA_INOX.md`.
