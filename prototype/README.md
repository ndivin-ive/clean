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
