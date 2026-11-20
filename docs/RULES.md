# Rules: Today ranking, health and coverage

> Status: defaults recorded at P1 (taken from the brief §5 and the companion
> prototype). The engine and its unit tests are built in **P3**; this file is
> updated there with worked examples. All values are stored per organisation
> (`rule_setting`, `role_cadence`, `pipeline_stage.typical_days`,
> `qualification_criterion`) and seeded from `src/domain/settings`.

## Today ranking — `rankActions(seller, now)`

Top **7** candidates by score. `score = round((base + bonus) × multiplier)`.

| Rule key    | Candidate                                                                               | Base                 | Bonus                       |
| ----------- | --------------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| `nextStep`  | Next-step date passed or missing on an open deal                                        | 30                   | amount factor               |
| `stalled`   | Days in stage > stage typical days                                                      | 25                   | amount factor               |
| `single`    | ≤ 1 engaged stakeholder and amount ≥ 50,000                                             | 25                   | —                           |
| `criterion` | Required-late criterion (economic buyer, decision process) unknown at Solution or later | 20                   | —                           |
| `forecast`  | Close within 30 days and no forecast category                                           | 20                   | —                           |
| `reconnect` | Key person past cadence (champion 14 d, economic buyer 30 d, decision maker 30 d)       | 15                   | relationship strength (1–5) |
| `signal`    | Signal detected in the last 7 days                                                      | 15                   | relevance (1–5)             |
| `renewal`   | Renewal within 90 days and plan not reviewed in 60 days                                 | 20                   | —                           |
| `prepare`   | Meeting within 24 h and brief not viewed                                                | 30                   | —                           |
| `proposals` | Pending capture proposals                                                               | 10 × n, capped at 40 | —                           |

- **Amount factor** = `round(15 × log10(1 + 9 × share))`, where share = deal amount ÷ seller's open pipeline (0–15 points).
- **Engaged** = last interaction within 60 days.
- **Multiplier** = the seller's "not relevant" adjustment for the rule: each click × 0.8, never below 0.4; reset in Settings (D-039).
- **State**: done, snoozed (until a date) and dismissed actions are stored with the rule's condition **fingerprint**; an action reappears when its fingerprint changes (e.g. a new next-step date) or when the snooze ends.

## Deal health — `assessDeal(deal)` (0–100)

| Factor                                                                                      | Points |
| ------------------------------------------------------------------------------------------- | ------ |
| Qualification coverage (confirmed = 1, partial = 0.5, over all criteria)                    | 30     |
| Engaged stakeholders: ≥ 3 including an economic buyer or decision maker = 20; 2 = 12; 1 = 5 | 20     |
| Next step present and dated in the future = 15; present but undated or passed = 7           | 15     |
| Most recent buyer contact: ≤ 14 d = 15; ≤ 30 d = 8                                          | 15     |
| Days in stage ≤ typical = 10; ≤ 1.5 × typical = 5                                           | 10     |
| Close date never pushed = 5; pushed once = 2                                                | 5      |
| Compelling event recorded                                                                   | 5      |

Bands: **Healthy ≥ 70 · Watch 40–69 · At risk < 40**. Every factor is returned as a reason.

## Account health — `assessAccount(account)` (0–100)

| Factor                                                                                 | Points |
| -------------------------------------------------------------------------------------- | ------ |
| Coverage of required roles (filled = 1, weak = 0.5)                                    | 30     |
| Executive contact (economic buyer / decision maker): ≤ 60 d = 15; ≤ 120 d = 7          | 15     |
| Open risks: none = 15; 1–2 = 8                                                         | 15     |
| Signals in 30 days: 5 + 2 per positive − 5 per negative, 0–10                          | 10     |
| Renewal under control: not a customer, renewal > 90 d, or plan reviewed ≤ 60 d         | 15     |
| Plan freshness: reviewed ≤ 60 d = 15; ≤ 120 d = 7; non-key account without a plan = 15 | 15     |

## Coverage map

Required roles (default): economic buyer, decision maker, champion, technical
evaluator, procurement. **Filled** = someone in the role with strength ≥ 3 and
engaged; **weak** = someone in the role but strength ≤ 2 or not engaged;
**missing** = nobody.
