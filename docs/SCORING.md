# Readiness scoring and effort (rules engine)

> Status: defaults recorded from the brief. The full specification, worked
> examples and test matrix are written in checkpoint 8 together with
> `assess()` in `src/domain/scoring/`.

`assess(request, ruleSet, today) → { score, breakdown[], effortPoints, effortBand, workingDaysToTarget, flags[] }`
is a pure function. All weights, bands, lead times and flag rules come from
`scoring_rule_set` (defaults seeded, admin-editable).

## Default readiness weights (total 100)

| Criterion                                                 | Max |
| --------------------------------------------------------- | --- |
| Clear objective (presence/length, outcome statement)      | 15  |
| Concrete success criteria (who commits to what)           | 15  |
| At least one expected outcome selected                    | 5   |
| Named customer attendees with titles                      | 15  |
| At least one decision maker or sponsor                    | 5   |
| Most senior attendee level given                          | 5   |
| Account plan status (documented/formal > informal > none) | 10  |
| Linked opportunity / stage beyond "no opportunity"        | 5   |
| Customer's own topics described                           | 10  |
| Follow-up owner described                                 | 5   |
| Lead time vs band's required lead time                    | 10  |

## Labels

≥ 75 Ready for triage · 50–74 Workable, some gaps · < 50 Needs more detail.

## Working days

Monday–Friday, no holiday calendar in Phase 1 (decision Q7).
