import { daysBetween } from "../time";
import type { Criterion, Deal, Person, Stage } from "../types";
import {
  assessment,
  daysSinceTouch,
  isEngaged,
  type Assessment,
  type Reason,
} from "./common";

export interface DealContext {
  now: Date;
  stage: Stage;
  criteria: Criterion[];
  people: Map<string, Person>;
  engagedDays?: number;
}

/** Deal health 0–100 with reasons (brief §5.2, weights in docs/RULES.md). */
export function assessDeal(deal: Deal, ctx: DealContext): Assessment {
  const { now, stage, criteria } = ctx;
  const engagedDays = ctx.engagedDays ?? 60;
  const reasons: Reason[] = [];

  const coveragePts = criteria.reduce((s, c) => {
    const st = deal.qualification[c.key] ?? "unknown";
    return s + (st === "confirmed" ? 1 : st === "partial" ? 0.5 : 0);
  }, 0);
  reasons.push({
    code: "qualification",
    points: criteria.length
      ? Math.round((coveragePts / criteria.length) * 30)
      : 0,
    max: 30,
    detail: { covered: coveragePts, total: criteria.length },
  });

  const stakeholders = deal.stakeholders
    .map((s) => ({ s, p: ctx.people.get(s.personId) }))
    .filter(
      (x): x is { s: (typeof deal.stakeholders)[number]; p: Person } => !!x.p,
    );
  const engaged = stakeholders.filter((x) => isEngaged(x.p, now, engagedDays));
  const senior = engaged.some(
    (x) => x.s.role === "economic_buyer" || x.s.role === "decision_maker",
  );
  reasons.push({
    code: "stakeholders",
    points:
      engaged.length >= 3 && senior
        ? 20
        : engaged.length >= 2
          ? 12
          : engaged.length === 1
            ? 5
            : 0,
    max: 20,
    detail: { engaged: engaged.length, senior: senior ? 1 : 0 },
  });

  const dated =
    !!deal.nextStep &&
    !!deal.nextStepDate &&
    daysBetween(now, deal.nextStepDate) >= 0;
  reasons.push({
    code: "next_step",
    points: dated ? 15 : deal.nextStep ? 7 : 0,
    max: 15,
    detail: { date: deal.nextStepDate },
  });

  const touches = engaged
    .map((x) => daysSinceTouch(x.p, now))
    .filter((d): d is number => d !== null);
  const last = touches.length ? Math.min(...touches) : null;
  reasons.push({
    code: "recency",
    points:
      last !== null && last <= 14 ? 15 : last !== null && last <= 30 ? 8 : 0,
    max: 15,
    detail: { days: last },
  });

  const age = daysBetween(deal.stageEnteredAt, now),
    typical = Math.max(1, stage.typicalDays);
  reasons.push({
    code: "stage_age",
    points: age <= typical ? 10 : age <= typical * 1.5 ? 5 : 0,
    max: 10,
    detail: { days: age, typical: stage.typicalDays },
  });

  reasons.push({
    code: "close_pushes",
    points: deal.closeDatePushes === 0 ? 5 : deal.closeDatePushes === 1 ? 2 : 0,
    max: 5,
    detail: { pushes: deal.closeDatePushes },
  });
  reasons.push({
    code: "compelling_event",
    points: deal.compellingEvent?.trim() ? 5 : 0,
    max: 5,
    detail: {},
  });

  return assessment(reasons);
}

/** Close-date pushes from stored events: a change to a later date counts as a push. */
export function countCloseDatePushes(
  events: { kind: string; fromValue: string | null; toValue: string | null }[],
): number {
  return events.filter(
    (e) =>
      e.kind === "close_date" &&
      e.fromValue &&
      e.toValue &&
      e.toValue > e.fromValue,
  ).length;
}
