import { describe, expect, it } from "vitest";
import { assessAccount } from "@/domain/rules/account-health";
import { band } from "@/domain/rules/common";
import { coverage } from "@/domain/rules/coverage";
import { assessDeal, countCloseDatePushes } from "@/domain/rules/deal-health";
import type { Deal, Person } from "@/domain/types";
import {
  account,
  allQual,
  CRITERIA,
  day,
  deal,
  iso,
  NOW,
  person,
  stage,
} from "./builders";

const ppl = (...ps: Person[]) => new Map(ps.map((p) => [p.id, p]));
const pts = (d: Deal, people: Map<string, Person>, code: string) =>
  assessDeal(d, {
    now: NOW,
    stage: stage(d.stageId),
    criteria: CRITERIA,
    people,
  }).reasons.find((r) => r.code === code)!.points;

describe("bands", () => {
  it.each([
    [100, "healthy"],
    [70, "healthy"],
    [69, "watch"],
    [40, "watch"],
    [39, "risk"],
    [0, "risk"],
  ])("%i → %s", (s, b) => expect(band(s)).toBe(b));
});

describe("deal health", () => {
  const eb = person({
    id: "eb",
    role: "economic_buyer",
    lastInteractionAt: day(-3),
  });
  const ch = person({
    id: "ch",
    role: "champion",
    lastInteractionAt: day(-10),
  });
  const te = person({
    id: "te",
    role: "technical_evaluator",
    lastInteractionAt: day(-20),
  });
  const perfect = deal({
    qualification: allQual("confirmed"),
    stakeholders: [
      { personId: "eb", role: "economic_buyer" },
      { personId: "ch", role: "champion" },
      { personId: "te", role: "technical_evaluator" },
    ],
  });

  it("scores 100 when every factor is met, with 7 reasons", () => {
    const a = assessDeal(perfect, {
      now: NOW,
      stage: stage("discovery"),
      criteria: CRITERIA,
      people: ppl(eb, ch, te),
    });
    expect(a.score).toBe(100);
    expect(a.band).toBe("healthy");
    expect(a.reasons.map((r) => r.code)).toEqual([
      "qualification",
      "stakeholders",
      "next_step",
      "recency",
      "stage_age",
      "close_pushes",
      "compelling_event",
    ]);
    expect(a.reasons.every((r) => r.points === r.max)).toBe(true);
  });
  it.each([
    ["confirmed", 30],
    ["partial", 15],
    ["unknown", 0],
  ] as const)("qualification all %s → %i", (s, p) => {
    expect(
      pts(deal({ qualification: allQual(s) }), ppl(), "qualification"),
    ).toBe(p);
  });
  it("stakeholders: 3 engaged with a senior = 20; 3 without senior = 12; 2 = 12; 1 = 5; 0 = 0", () => {
    const u = person({ id: "u", role: "user" });
    expect(pts(perfect, ppl(eb, ch, te), "stakeholders")).toBe(20);
    expect(
      pts(
        deal({
          stakeholders: [
            { personId: "ch", role: "champion" },
            { personId: "te", role: "technical_evaluator" },
            { personId: "u", role: "user" },
          ],
        }),
        ppl(ch, te, u),
        "stakeholders",
      ),
    ).toBe(12);
    expect(
      pts(
        deal({
          stakeholders: [
            { personId: "ch", role: "champion" },
            { personId: "te", role: "technical_evaluator" },
          ],
        }),
        ppl(ch, te),
        "stakeholders",
      ),
    ).toBe(12);
    expect(
      pts(
        deal({ stakeholders: [{ personId: "ch", role: "champion" }] }),
        ppl(ch),
        "stakeholders",
      ),
    ).toBe(5);
    expect(pts(deal(), ppl(), "stakeholders")).toBe(0);
  });
  it.each([
    ["future date", { nextStepDate: iso(2) }, 15],
    ["today", { nextStepDate: iso(0) }, 15],
    ["passed", { nextStepDate: iso(-1) }, 7],
    ["no date", { nextStepDate: null }, 7],
    ["no step", { nextStep: null, nextStepDate: null }, 0],
  ])("next step %s", (_l, o, p) =>
    expect(pts(deal(o), ppl(), "next_step")).toBe(p),
  );
  it.each([
    [14, 15],
    [15, 8],
    [30, 8],
    [31, 0],
  ])("last buyer contact %i days ago → %i", (days, p) => {
    const x = person({ id: "x", lastInteractionAt: day(-days) });
    expect(
      pts(
        deal({ stakeholders: [{ personId: "x", role: "champion" }] }),
        ppl(x),
        "recency",
      ),
    ).toBe(p);
  });
  it.each([
    [21, 10],
    [31, 5],
    [32, 0],
  ])("%i days in Discovery (typical 21) → %i", (days, p) => {
    expect(pts(deal({ stageEnteredAt: day(-days) }), ppl(), "stage_age")).toBe(
      p,
    );
  });
  it.each([
    [0, 5],
    [1, 2],
    [3, 0],
  ])("close date pushed %i times → %i", (n, p) =>
    expect(pts(deal({ closeDatePushes: n }), ppl(), "close_pushes")).toBe(p),
  );
  it("compelling event present → 5, blank → 0", () => {
    expect(pts(deal(), ppl(), "compelling_event")).toBe(5);
    expect(pts(deal({ compellingEvent: " " }), ppl(), "compelling_event")).toBe(
      0,
    );
  });
  it("counts close-date pushes from events (later dates only)", () => {
    expect(
      countCloseDatePushes([
        { kind: "close_date", fromValue: "2026-12-01", toValue: "2026-12-15" },
        { kind: "close_date", fromValue: "2026-12-15", toValue: "2026-12-10" },
        { kind: "close_date", fromValue: null, toValue: "2026-12-10" },
        { kind: "stage", fromValue: "a", toValue: "b" },
      ]),
    ).toBe(1);
  });
});

describe("coverage", () => {
  it("filled, weak (low strength or stale) and missing", () => {
    const c = coverage(
      [
        person({ id: "a", role: "economic_buyer", strength: 4 }),
        person({ id: "b", role: "champion", strength: 2 }),
        person({
          id: "c",
          role: "decision_maker",
          strength: 5,
          lastInteractionAt: day(-90),
        }),
      ],
      NOW,
    );
    expect(Object.fromEntries(c.map((x) => [x.role, x.status]))).toEqual({
      economic_buyer: "filled",
      decision_maker: "weak",
      champion: "weak",
      technical_evaluator: "missing",
      procurement: "missing",
    });
  });
});

describe("account health", () => {
  const base = { now: NOW, signals: [], plan: null };
  const full = [
    person({ id: "1", role: "economic_buyer", strength: 4 }),
    person({ id: "2", role: "decision_maker", strength: 4 }),
    person({ id: "3", role: "champion", strength: 4 }),
    person({ id: "4", role: "technical_evaluator", strength: 4 }),
    person({ id: "5", role: "procurement", strength: 4 }),
  ];
  const r = (a: ReturnType<typeof assessAccount>, code: string) =>
    a.reasons.find((x) => x.code === code)!.points;

  it("a fully covered, fresh, risk-free account with no signals scores 95 (signals neutral at 5/10)", () => {
    const a = assessAccount(
      account({ tier: "key", relationship: "customer", renewalDate: iso(40) }),
      {
        ...base,
        people: full,
        plan: { accountId: "a1", lastReviewedAt: day(-10), openRisks: 0 },
      },
    );
    expect(a.score).toBe(95);
    expect(r(a, "signals")).toBe(5);
    expect(
      a.reasons
        .filter((x) => x.code !== "signals")
        .every((x) => x.points === x.max),
    ).toBe(true);
  });
  it("key account without a plan loses plan freshness; growth account does not", () => {
    expect(
      r(
        assessAccount(account({ tier: "key" }), { ...base, people: full }),
        "plan_freshness",
      ),
    ).toBe(0);
    expect(
      r(
        assessAccount(account({ tier: "growth" }), { ...base, people: full }),
        "plan_freshness",
      ),
    ).toBe(15);
  });
  it("renewal within 90 days with a stale plan loses the renewal points", () => {
    const a = assessAccount(
      account({ relationship: "customer", renewalDate: iso(70) }),
      {
        ...base,
        people: full,
        plan: { accountId: "a1", lastReviewedAt: day(-80), openRisks: 0 },
      },
    );
    expect(r(a, "renewal")).toBe(0);
    expect(r(a, "plan_freshness")).toBe(7);
  });
  it.each([
    [0, 15],
    [2, 8],
    [3, 0],
  ])("%i open risks → %i", (n, p) => {
    expect(
      r(
        assessAccount(account(), {
          ...base,
          people: [],
          plan: { accountId: "a1", lastReviewedAt: day(-1), openRisks: n },
        }),
        "risks",
      ),
    ).toBe(p);
  });
  it("signals: a recent job change (negative) costs points, news (positive) adds them, clamped 0–10", () => {
    const sig = (type: string, age = 2) => ({
      id: type + age,
      accountId: "a1",
      type,
      title: type,
      detectedAt: day(-age),
      relevance: 3,
    });
    expect(
      r(
        assessAccount(account(), {
          ...base,
          people: [],
          signals: [sig("job_change")],
        }),
        "signals",
      ),
    ).toBe(0);
    expect(
      r(
        assessAccount(account(), {
          ...base,
          people: [],
          signals: [sig("news"), sig("funding"), sig("tender"), sig("hiring")],
        }),
        "signals",
      ),
    ).toBe(10);
    expect(
      r(
        assessAccount(account(), {
          ...base,
          people: [],
          signals: [sig("news", 40)],
        }),
        "signals",
      ),
    ).toBe(5);
  });
  it("executive contact: ≤ 60 days = 15, ≤ 120 = 7, never = 0", () => {
    const at = (d: number | null) =>
      r(
        assessAccount(account(), {
          ...base,
          people: [
            person({
              role: "economic_buyer",
              lastInteractionAt: d === null ? null : day(-d),
            }),
          ],
        }),
        "executive_contact",
      );
    expect([at(60), at(120), at(121), at(null)]).toEqual([15, 7, 0, 0]);
  });
});
