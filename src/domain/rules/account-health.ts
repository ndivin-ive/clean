import { daysBetween } from "../time";
import type {
  Account,
  AccountPlan,
  DecisionRole,
  Person,
  Signal,
} from "../types";
import {
  assessment,
  daysSinceTouch,
  type Assessment,
  type Reason,
} from "./common";
import { coverage, type RoleCoverage } from "./coverage";

export interface AccountContext {
  now: Date;
  people: Person[];
  signals: Signal[];
  plan: AccountPlan | null;
  /** Open risks recorded on the account's deals (added to the plan's risks). */
  dealRisks?: number;
  requiredRoles?: DecisionRole[];
  engagedDays?: number;
}

const NEGATIVE_SIGNALS = new Set(["job_change", "usage_drop"]);

/** Account health 0–100 with reasons (brief §5.3, weights in docs/RULES.md). */
export function assessAccount(
  account: Account,
  ctx: AccountContext,
): Assessment & { coverage: RoleCoverage[] } {
  const { now, plan } = ctx;
  const cov = coverage(ctx.people, now, {
    requiredRoles: ctx.requiredRoles,
    engagedDays: ctx.engagedDays,
  });
  const reasons: Reason[] = [];

  const covPts = cov.reduce(
    (s, c) => s + (c.status === "filled" ? 1 : c.status === "weak" ? 0.5 : 0),
    0,
  );
  reasons.push({
    code: "coverage",
    points: cov.length ? Math.round((covPts / cov.length) * 30) : 0,
    max: 30,
    detail: { covered: covPts, total: cov.length },
  });

  const exec = ctx.people
    .filter((p) => p.role === "economic_buyer" || p.role === "decision_maker")
    .map((p) => daysSinceTouch(p, now))
    .filter((d): d is number => d !== null);
  const lastExec = exec.length ? Math.min(...exec) : null;
  reasons.push({
    code: "executive_contact",
    points:
      lastExec !== null && lastExec <= 60
        ? 15
        : lastExec !== null && lastExec <= 120
          ? 7
          : 0,
    max: 15,
    detail: { days: lastExec },
  });

  const risks = (plan?.openRisks ?? 0) + (ctx.dealRisks ?? 0);
  reasons.push({
    code: "risks",
    points: risks === 0 ? 15 : risks <= 2 ? 8 : 0,
    max: 15,
    detail: { open: risks },
  });

  const recent = ctx.signals.filter(
    (s) => s.accountId === account.id && daysBetween(s.detectedAt, now) <= 30,
  );
  const negative = recent.filter((s) => NEGATIVE_SIGNALS.has(s.type)).length,
    positive = recent.length - negative;
  reasons.push({
    code: "signals",
    points: Math.max(0, Math.min(10, 5 + positive * 2 - negative * 5)),
    max: 10,
    detail: { positive, negative },
  });

  const renewalIn = account.renewalDate
    ? daysBetween(now, account.renewalDate)
    : null;
  const planAge = plan?.lastReviewedAt
    ? daysBetween(plan.lastReviewedAt, now)
    : null;
  const renewalOk =
    account.relationship !== "customer" ||
    renewalIn === null ||
    renewalIn > 90 ||
    (planAge !== null && planAge <= 60);
  reasons.push({
    code: "renewal",
    points: renewalOk ? 15 : 0,
    max: 15,
    detail: { days: renewalIn },
  });

  const freshPts =
    planAge === null
      ? account.tier === "key"
        ? 0
        : 15
      : planAge <= 60
        ? 15
        : planAge <= 120
          ? 7
          : 0;
  reasons.push({
    code: "plan_freshness",
    points: freshPts,
    max: 15,
    detail: { days: planAge },
  });

  return { ...assessment(reasons), coverage: cov };
}
