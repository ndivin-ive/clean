import { describe, expect, it } from "vitest";
import {
  amountFactor,
  applyTeach,
  candidates,
  isSuppressed,
  rankActions,
  type Candidate,
} from "@/domain/rules/today";
import {
  DEFAULT_RULE_SETTINGS,
  resolveRuleSettings,
} from "@/domain/settings/defaults";
import { account, book, day, deal, iso, NOW, person } from "./builders";

const rules = (b: ReturnType<typeof book>) =>
  candidates(b).map((c) => c.ruleKey);
const only = (b: ReturnType<typeof book>, rule: string) =>
  candidates(b).filter((c) => c.ruleKey === rule);

describe("baseline", () => {
  it("a healthy quiet deal produces no action", () => {
    expect(candidates(book({ deals: [deal()] }))).toEqual([]);
  });
  it("closed deals produce no deal actions", () => {
    expect(
      rules(
        book({
          deals: [
            deal({ stageId: "won", nextStep: null }),
            deal({ id: "d2", stageId: "lost", nextStep: null }),
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe("rule: next step missing or passed", () => {
  it.each([
    ["missing", { nextStep: null }, "next_step_missing"],
    ["blank", { nextStep: "  " }, "next_step_missing"],
    ["passed yesterday", { nextStepDate: iso(-1) }, "next_step_passed"],
  ])("triggers when %s", (_l, o, code) => {
    const [c] = only(book({ deals: [deal(o)] }), "nextStep");
    expect(c?.reason.code).toBe(code);
    expect(c?.base).toBe(30);
  });
  it.each([
    ["today", iso(0)],
    ["future", iso(4)],
  ])("does not trigger when the date is %s", (_l, d) => {
    expect(
      only(book({ deals: [deal({ nextStepDate: d })] }), "nextStep"),
    ).toEqual([]);
  });
  it("adds the amount factor (share of open pipeline)", () => {
    const [c] = only(
      book({
        deals: [
          deal({ nextStep: null, amount: 100_000 }),
          deal({ id: "d2", amount: 100_000 }),
        ],
      }),
      "nextStep",
    );
    expect(c?.bonus).toBe(amountFactor(100_000, 200_000, 15));
    expect(c?.score).toBe(30 + c!.bonus);
  });
  it("fingerprint changes when the next step changes", () => {
    const a = only(
      book({ deals: [deal({ nextStepDate: iso(-1) })] }),
      "nextStep",
    )[0]!;
    const b = only(
      book({ deals: [deal({ nextStepDate: iso(-2) })] }),
      "nextStep",
    )[0]!;
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});

describe("rule: stalled beyond typical time", () => {
  it("triggers the day after the typical time (Discovery = 21 days)", () => {
    expect(
      only(book({ deals: [deal({ stageEnteredAt: day(-22) })] }), "stalled"),
    ).toHaveLength(1);
    expect(
      only(book({ deals: [deal({ stageEnteredAt: day(-21) })] }), "stalled"),
    ).toHaveLength(0);
  });
  it("reports days and typical time", () => {
    const [c] = only(
      book({ deals: [deal({ stageEnteredAt: day(-36) })] }),
      "stalled",
    );
    expect(c?.reason.params).toMatchObject({ days: 36, typical: 21 });
  });
});

describe("rule: single-threaded", () => {
  const p1 = person({ id: "p1" }),
    p2 = person({ id: "p2" }),
    stale = person({ id: "p3", lastInteractionAt: day(-61) });
  it("triggers with one engaged contact at the threshold amount", () => {
    expect(
      only(
        book({
          people: [p1],
          deals: [
            deal({
              amount: 50_000,
              stakeholders: [{ personId: "p1", role: "champion" }],
            }),
          ],
        }),
        "single",
      ),
    ).toHaveLength(1);
  });
  it("does not trigger below the threshold", () => {
    expect(
      only(
        book({
          people: [p1],
          deals: [
            deal({
              amount: 49_999,
              stakeholders: [{ personId: "p1", role: "champion" }],
            }),
          ],
        }),
        "single",
      ),
    ).toHaveLength(0);
  });
  it("does not trigger with two engaged contacts", () => {
    expect(
      only(
        book({
          people: [p1, p2],
          deals: [
            deal({
              amount: 90_000,
              stakeholders: [
                { personId: "p1", role: "champion" },
                { personId: "p2", role: "user" },
              ],
            }),
          ],
        }),
        "single",
      ),
    ).toHaveLength(0);
  });
  it("a contact silent for more than 60 days is not engaged", () => {
    const [c] = only(
      book({
        people: [p1, stale],
        deals: [
          deal({
            amount: 90_000,
            stakeholders: [
              { personId: "p1", role: "champion" },
              { personId: "p3", role: "user" },
            ],
          }),
        ],
      }),
      "single",
    );
    expect(c?.reason.params.engaged).toBe(1);
  });
});

describe("rule: key criterion unknown at a late stage", () => {
  it("one action per required-late criterion still unknown from Solution onwards", () => {
    const cs = only(
      book({
        deals: [
          deal({
            stageId: "solution",
            qualification: {
              economic_buyer: "unknown",
              decision_process: "unknown",
            },
          }),
        ],
      }),
      "criterion",
    );
    expect(cs.map((c) => c.reason.params.criterion).sort()).toEqual([
      "decision_process",
      "economic_buyer",
    ]);
  });
  it("not before the late stage, and not when partially known", () => {
    expect(
      only(
        book({ deals: [deal({ stageId: "discovery", qualification: {} })] }),
        "criterion",
      ),
    ).toHaveLength(0);
    expect(
      only(
        book({
          deals: [
            deal({
              stageId: "proposal",
              qualification: {
                economic_buyer: "partial",
                decision_process: "confirmed",
              },
            }),
          ],
        }),
        "criterion",
      ),
    ).toHaveLength(0);
  });
});

describe("rule: forecast not called", () => {
  it.each([
    [30, 1],
    [0, 1],
    [31, 0],
    [-1, 0],
  ])("close in %i days → %i action(s)", (days, n) => {
    expect(
      only(
        book({
          deals: [deal({ closeDate: iso(days), forecastCategory: null })],
        }),
        "forecast",
      ),
    ).toHaveLength(n);
  });
  it("not when a category is set", () => {
    expect(
      only(
        book({
          deals: [deal({ closeDate: iso(5), forecastCategory: "commit" })],
        }),
        "forecast",
      ),
    ).toHaveLength(0);
  });
});

describe("rule: reconnect with key people", () => {
  const withDeal = (p: ReturnType<typeof person>) =>
    book({ people: [p], deals: [deal()] });
  it.each([
    ["champion", 15, 1],
    ["champion", 14, 0],
    ["economic_buyer", 31, 1],
    ["economic_buyer", 30, 0],
    ["decision_maker", 31, 1],
    ["influencer", 200, 0],
  ] as const)("%s last touched %i days ago → %i", (role, days, n) => {
    expect(
      only(
        withDeal(person({ role, lastInteractionAt: day(-days) })),
        "reconnect",
      ),
    ).toHaveLength(n);
  });
  it("never contacted counts, with its own reason", () => {
    const [c] = only(
      withDeal(person({ role: "economic_buyer", lastInteractionAt: null })),
      "reconnect",
    );
    expect(c?.reason.code).toBe("reconnect_never");
  });
  it("adds relationship strength as bonus", () => {
    expect(
      only(
        withDeal(
          person({
            role: "champion",
            strength: 4,
            lastInteractionAt: day(-20),
          }),
        ),
        "reconnect",
      )[0]?.score,
    ).toBe(19);
  });
  it("ignores accounts with no open deal unless they are key accounts", () => {
    const p = person({ role: "champion", lastInteractionAt: day(-40) });
    expect(only(book({ people: [p] }), "reconnect")).toHaveLength(0);
    expect(
      only(
        book({ people: [p], accounts: [account({ tier: "key" })] }),
        "reconnect",
      ),
    ).toHaveLength(1);
  });
});

describe("rule: new signal", () => {
  it.each([
    [7, 1],
    [0, 1],
    [8, 0],
  ])("detected %i days ago → %i", (age, n) => {
    expect(
      only(
        book({
          signals: [
            {
              id: "s1",
              accountId: "a1",
              type: "news",
              title: "News",
              detectedAt: day(-age),
              relevance: 3,
            },
          ],
        }),
        "signal",
      ),
    ).toHaveLength(n);
  });
  it("adds relevance as bonus", () => {
    expect(
      only(
        book({
          signals: [
            {
              id: "s1",
              accountId: "a1",
              type: "tender",
              title: "Tender",
              detectedAt: day(-1),
              relevance: 5,
            },
          ],
        }),
        "signal",
      )[0]?.score,
    ).toBe(20);
  });
});

describe("rule: renewal with a stale plan", () => {
  const acc = account({ relationship: "customer", renewalDate: iso(90) });
  it.each([
    [
      "plan 61 days old",
      [{ accountId: "a1", lastReviewedAt: day(-61), openRisks: 0 }],
      1,
    ],
    [
      "plan 60 days old",
      [{ accountId: "a1", lastReviewedAt: day(-60), openRisks: 0 }],
      0,
    ],
    ["no plan", [], 1],
  ])("renewal in 90 days, %s", (_l, plans, n) => {
    expect(only(book({ accounts: [acc], plans }), "renewal")).toHaveLength(n);
  });
  it("not when the renewal is more than 90 days away", () => {
    expect(
      only(book({ accounts: [account({ renewalDate: iso(91) })] }), "renewal"),
    ).toHaveLength(0);
  });
});

describe("rule: prepare for a meeting", () => {
  const m = (hours: number, viewed = false) => ({
    id: "m1",
    accountId: "a1",
    dealId: null,
    title: "QBR",
    startsAt: new Date(NOW.getTime() + hours * 3_600_000),
    briefViewed: viewed,
  });
  it.each([
    [23, false, 1],
    [24, false, 1],
    [25, false, 0],
    [-1, false, 0],
    [5, true, 0],
  ])("meeting in %i h, viewed=%s → %i", (h, v, n) => {
    expect(only(book({ meetings: [m(h, v)] }), "prepare")).toHaveLength(n);
  });
});

describe("rule: pending proposals", () => {
  it.each([
    [1, 10],
    [2, 20],
    [5, 40],
    [9, 40],
  ])("%i pending → base %i (capped at 40)", (n, base) => {
    expect(only(book({ pendingProposals: n }), "proposals")[0]?.base).toBe(
      base,
    );
  });
});

describe("amount factor", () => {
  it.each([
    [0, 0],
    [10_000, 4],
    [50_000, 11],
    [100_000, 15],
  ])("amount %i of 100,000 → %i points", (amount, pts) => {
    expect(amountFactor(amount, 100_000, 15)).toBe(pts);
  });
  it("is 0 for an empty pipeline", () =>
    expect(amountFactor(10, 0, 15)).toBe(0));
});

describe("teach (not relevant)", () => {
  it("multiplies by 0.8 per click with a 0.4 floor", () => {
    const seq = [1];
    for (let i = 0; i < 6; i++) seq.push(applyTeach(seq.at(-1)));
    expect(seq).toEqual([1, 0.8, 0.64, 0.51, 0.41, 0.4, 0.4]);
  });
  it("lowers the score of that rule only", () => {
    const b = book({
      deals: [deal({ nextStep: null, stageEnteredAt: day(-30) })],
      adjustments: { nextStep: 0.5 },
    });
    const byRule = Object.fromEntries(candidates(b).map((c) => [c.ruleKey, c]));
    expect(byRule.nextStep!.score).toBe(
      Math.round((30 + byRule.nextStep!.bonus) * 0.5),
    );
    expect(byRule.stalled!.multiplier).toBe(1);
  });
});

describe("done, snooze and dismiss", () => {
  const c: Pick<Candidate, "ruleKey" | "subjectKey" | "fingerprint"> = {
    ruleKey: "nextStep",
    subjectKey: "d1",
    fingerprint: "a",
  };
  const st = (
    status: "done" | "dismissed" | "snoozed",
    fingerprint = "a",
    snoozedUntil: Date | null = null,
  ) => [
    {
      ruleKey: "nextStep",
      subjectKey: "d1",
      fingerprint,
      status,
      snoozedUntil,
    },
  ];
  it.each([
    ["done, same condition", st("done"), true],
    ["dismissed, same condition", st("dismissed"), true],
    ["done, condition changed", st("done", "b"), false],
    ["dismissed, condition changed", st("dismissed", "b"), false],
    ["snoozed until tomorrow", st("snoozed", "a", day(1)), true],
    ["snooze expired", st("snoozed", "a", day(-1)), false],
    ["snoozed but condition changed", st("snoozed", "b", day(3)), false],
  ] as const)("%s → hidden: %s", (_l, states, hidden) => {
    expect(isSuppressed(c, [...states], NOW)).toBe(hidden);
  });
});

describe("rankActions", () => {
  const many = book({
    deals: Array.from({ length: 10 }, (_, i) =>
      deal({
        id: `d${i}`,
        name: `Deal ${i}`,
        amount: 10_000 * (i + 1),
        nextStep: null,
      }),
    ),
  });
  it("returns the top 7 by score, highest first", () => {
    const top = rankActions(many);
    expect(top).toHaveLength(7);
    expect(top.map((c) => c.score)).toEqual(
      [...top.map((c) => c.score)].sort((a, b) => b - a),
    );
    // nothing left out may outrank anything kept; the smallest deal is cut
    const all = candidates(many);
    const kept = new Set(top.map((c) => c.subjectKey));
    const minKept = Math.min(...top.map((c) => c.score));
    expect(
      all
        .filter((c) => !kept.has(c.subjectKey))
        .every((c) => c.score <= minKept),
    ).toBe(true);
    expect(kept.has("d0")).toBe(false);
    expect(kept.has("d9")).toBe(true);
  });
  it("respects the configured top N", () => {
    expect(
      rankActions({ ...many, settings: { ...many.settings, "today.topN": 3 } }),
    ).toHaveLength(3);
  });
  it("is deterministic on ties (rule order, then subject)", () => {
    const b = book({
      deals: [
        deal({ id: "dB", nextStep: null, amount: 1 }),
        deal({ id: "dA", nextStep: null, amount: 1 }),
      ],
    });
    expect(rankActions(b).map((c) => c.subjectKey)).toEqual(["dA", "dB"]);
  });
  it("drops suppressed actions and lets the next one in", () => {
    const top = rankActions(many);
    const states = [
      {
        ruleKey: top[0]!.ruleKey,
        subjectKey: top[0]!.subjectKey,
        fingerprint: top[0]!.fingerprint,
        status: "dismissed" as const,
        snoozedUntil: null,
      },
    ];
    const next = rankActions({ ...many, states });
    expect(next.map((c) => c.subjectKey)).not.toContain(top[0]!.subjectKey);
    expect(next).toHaveLength(7);
  });
});

describe("settings", () => {
  it("stored values override defaults; unknown, negative and non-finite values are ignored", () => {
    const s = resolveRuleSettings([
      { key: "today.weight.signal", value: 40 },
      { key: "nope", value: 1 },
      { key: "today.topN", value: -2 },
      { key: "today.weight.stalled", value: Number.NaN },
    ]);
    expect(s["today.weight.signal"]).toBe(40);
    expect(s["today.topN"]).toBe(DEFAULT_RULE_SETTINGS["today.topN"]);
    expect(s["today.weight.stalled"]).toBe(25);
    expect("nope" in s).toBe(false);
  });
});
