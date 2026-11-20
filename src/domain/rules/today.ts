import { DEFAULT_CADENCES, type RuleSettings } from "../settings/defaults";
import { daysBetween } from "../time";
import type {
  Account,
  AccountPlan,
  ActionState,
  Criterion,
  DecisionRole,
  Deal,
  Meeting,
  Person,
  Signal,
  Stage,
} from "../types";
import { isEngaged } from "./common";

export const TODAY_RULES = [
  "nextStep",
  "stalled",
  "single",
  "criterion",
  "forecast",
  "reconnect",
  "signal",
  "renewal",
  "prepare",
  "proposals",
] as const;
export type TodayRule = (typeof TODAY_RULES)[number];

export interface Book {
  now: Date;
  settings: RuleSettings;
  stages: Stage[];
  criteria: Criterion[];
  cadences?: Partial<Record<DecisionRole, number>>;
  accounts: Account[];
  people: Person[];
  deals: Deal[];
  signals: Signal[];
  meetings: Meeting[];
  plans: AccountPlan[];
  pendingProposals: number;
  states: ActionState[];
  /** "Not relevant" multipliers per rule (0.4–1). */
  adjustments: Partial<Record<TodayRule, number>>;
}

export type Target =
  | { kind: "deal" | "account" | "person" | "meeting" | "plan"; id: string }
  | { kind: "proposals" };

export interface Candidate {
  ruleKey: TodayRule;
  subjectKey: string;
  /** Changes when the underlying situation changes; done/dismissed actions return then. */
  fingerprint: string;
  base: number;
  bonus: number;
  multiplier: number;
  score: number;
  reason: { code: string; params: Record<string, string | number> };
  target: Target;
  accountId?: string;
  dealId?: string;
  personId?: string;
}

/** Log-scaled share of the seller's open pipeline, 0 … max points (docs/RULES.md). */
export function amountFactor(
  amount: number,
  openPipeline: number,
  max: number,
): number {
  if (openPipeline <= 0 || amount <= 0) return 0;
  const share = Math.min(1, amount / openPipeline);
  return Math.round(max * Math.log10(1 + 9 * share));
}

/** Each "not relevant" click multiplies the rule weight by `factor`, never below `floor`. */
export function applyTeach(
  current: number | undefined,
  factor = 0.8,
  floor = 0.4,
): number {
  return Math.max(floor, Math.round((current ?? 1) * factor * 100) / 100);
}

const isOpenDeal = (d: Deal, stages: Map<string, Stage>) => {
  const st = stages.get(d.stageId);
  return !!st && !st.isWon && !st.isLost;
};

/** All candidate actions for the seller's book, scored, before state filtering. */
export function candidates(book: Book): Candidate[] {
  const { now, settings: W } = book;
  const stages = new Map(book.stages.map((s) => [s.id, s]));
  const people = new Map(book.people.map((p) => [p.id, p]));
  const open = book.deals.filter((d) => isOpenDeal(d, stages));
  const pipeline = open.reduce((s, d) => s + (d.amount || 0), 0);
  const af = (d: Deal) =>
    amountFactor(d.amount, pipeline, W["today.amountFactorMax"]);
  const cadences = { ...DEFAULT_CADENCES, ...book.cadences };
  const out: Omit<Candidate, "multiplier" | "score">[] = [];

  for (const d of open) {
    const st = stages.get(d.stageId)!;
    // 1. next step missing or passed
    const passed = !!d.nextStepDate && daysBetween(d.nextStepDate, now) > 0;
    if (!d.nextStep?.trim() || passed) {
      out.push({
        ruleKey: "nextStep",
        subjectKey: d.id,
        fingerprint: `${d.nextStep ?? ""}|${d.nextStepDate ?? ""}`,
        base: W["today.weight.nextStep"],
        bonus: af(d),
        reason: {
          code: passed ? "next_step_passed" : "next_step_missing",
          params: { deal: d.name, date: d.nextStepDate ?? "" },
        },
        target: { kind: "deal", id: d.id },
        dealId: d.id,
        accountId: d.accountId,
      });
    }
    // 2. stalled beyond the stage's typical time
    const age = daysBetween(d.stageEnteredAt, now);
    if (st.typicalDays > 0 && age > st.typicalDays) {
      out.push({
        ruleKey: "stalled",
        subjectKey: d.id,
        fingerprint: `${d.stageId}`,
        base: W["today.weight.stalled"],
        bonus: af(d),
        reason: {
          code: "stalled",
          params: {
            deal: d.name,
            days: age,
            typical: st.typicalDays,
            stageId: st.id,
          },
        },
        target: { kind: "deal", id: d.id },
        dealId: d.id,
        accountId: d.accountId,
      });
    }
    // 3. single-threaded above the amount threshold
    const engaged = d.stakeholders
      .map((s) => people.get(s.personId))
      .filter(
        (p): p is Person => !!p && isEngaged(p, now, W["today.engagedDays"]),
      );
    if (engaged.length <= 1 && d.amount >= W["today.singleThreadAmount"]) {
      out.push({
        ruleKey: "single",
        subjectKey: d.id,
        fingerprint: `${engaged.length}`,
        base: W["today.weight.single"],
        bonus: 0,
        reason: {
          code: "single_threaded",
          params: { deal: d.name, engaged: engaged.length, amount: d.amount },
        },
        target: { kind: "deal", id: d.id },
        dealId: d.id,
        accountId: d.accountId,
      });
    }
    // 4. required-late criterion unknown at a late stage
    if (st.sortOrder >= W["today.lateStageOrder"]) {
      for (const c of book.criteria.filter((c) => c.requiredLate)) {
        if ((d.qualification[c.key] ?? "unknown") === "unknown") {
          out.push({
            ruleKey: "criterion",
            subjectKey: `${d.id}:${c.key}`,
            fingerprint: "unknown",
            base: W["today.weight.criterion"],
            bonus: 0,
            reason: {
              code: "criterion_unknown",
              params: { deal: d.name, criterion: c.key, stageId: st.id },
            },
            target: { kind: "deal", id: d.id },
            dealId: d.id,
            accountId: d.accountId,
          });
        }
      }
    }
    // 5. close soon, no forecast category
    if (d.closeDate && !d.forecastCategory) {
      const toClose = daysBetween(now, d.closeDate);
      if (toClose >= 0 && toClose <= W["today.closeWindowDays"]) {
        out.push({
          ruleKey: "forecast",
          subjectKey: d.id,
          fingerprint: "unset",
          base: W["today.weight.forecast"],
          bonus: 0,
          reason: {
            code: "forecast_unset",
            params: { deal: d.name, days: toClose },
          },
          target: { kind: "deal", id: d.id },
          dealId: d.id,
          accountId: d.accountId,
        });
      }
    }
  }

  // 6. key people past their cadence (on accounts with an open deal, or key accounts)
  const activeAccounts = new Set(open.map((d) => d.accountId));
  const keyAccounts = new Set(
    book.accounts.filter((a) => a.tier === "key").map((a) => a.id),
  );
  for (const p of book.people) {
    const cadence = cadences[p.role];
    if (
      !cadence ||
      !(activeAccounts.has(p.accountId) || keyAccounts.has(p.accountId))
    )
      continue;
    const since = p.lastInteractionAt
      ? daysBetween(p.lastInteractionAt, now)
      : null;
    if (since === null || since > cadence) {
      out.push({
        ruleKey: "reconnect",
        subjectKey: p.id,
        fingerprint: p.lastInteractionAt?.toISOString() ?? "never",
        base: W["today.weight.reconnect"],
        bonus: Math.max(0, Math.min(5, p.strength)),
        reason: {
          code: since === null ? "reconnect_never" : "reconnect",
          params: { person: p.name, role: p.role, days: since ?? -1, cadence },
        },
        target: { kind: "person", id: p.id },
        personId: p.id,
        accountId: p.accountId,
      });
    }
  }

  // 7. fresh signals
  for (const s of book.signals) {
    const age = daysBetween(s.detectedAt, now);
    if (age >= 0 && age <= W["today.signalDays"]) {
      out.push({
        ruleKey: "signal",
        subjectKey: s.id,
        fingerprint: s.id,
        base: W["today.weight.signal"],
        bonus: Math.max(0, Math.min(5, s.relevance ?? 0)),
        reason: {
          code: "signal",
          params: { title: s.title, accountId: s.accountId },
        },
        target: { kind: "account", id: s.accountId },
        accountId: s.accountId,
      });
    }
  }

  // 8. renewal coming, plan stale
  const plans = new Map(book.plans.map((p) => [p.accountId, p]));
  for (const a of book.accounts) {
    if (!a.renewalDate) continue;
    const renewalIn = daysBetween(now, a.renewalDate);
    const plan = plans.get(a.id);
    const planAge = plan?.lastReviewedAt
      ? daysBetween(plan.lastReviewedAt, now)
      : null;
    if (
      renewalIn >= 0 &&
      renewalIn <= W["today.renewalWindowDays"] &&
      (planAge === null || planAge > W["today.planStaleDays"])
    ) {
      out.push({
        ruleKey: "renewal",
        subjectKey: a.id,
        fingerprint: plan?.lastReviewedAt?.toISOString() ?? "never",
        base: W["today.weight.renewal"],
        bonus: 0,
        reason: {
          code: "renewal_plan_stale",
          params: { account: a.name, days: renewalIn, planAge: planAge ?? -1 },
        },
        target: { kind: "plan", id: a.id },
        accountId: a.id,
      });
    }
  }

  // 9. meeting soon, brief not viewed
  for (const m of book.meetings) {
    const hours = (m.startsAt.getTime() - now.getTime()) / 3_600_000;
    if (hours >= 0 && hours <= W["today.prepareHours"] && !m.briefViewed) {
      out.push({
        ruleKey: "prepare",
        subjectKey: m.id,
        fingerprint: "unviewed",
        base: W["today.weight.prepare"],
        bonus: 0,
        reason: {
          code: "prepare_meeting",
          params: { meeting: m.title, startsAt: m.startsAt.toISOString() },
        },
        target: { kind: "meeting", id: m.id },
        accountId: m.accountId,
        ...(m.dealId ? { dealId: m.dealId } : {}),
      });
    }
  }

  // 10. pending capture proposals
  if (book.pendingProposals > 0) {
    out.push({
      ruleKey: "proposals",
      subjectKey: "pending",
      fingerprint: String(book.pendingProposals),
      base: Math.min(
        W["today.proposalCap"],
        W["today.weight.proposals"] * book.pendingProposals,
      ),
      bonus: 0,
      reason: {
        code: "proposals_pending",
        params: { n: book.pendingProposals },
      },
      target: { kind: "proposals" },
    });
  }

  return out.map((c) => {
    const multiplier = book.adjustments[c.ruleKey] ?? 1;
    return {
      ...c,
      multiplier,
      score: Math.round((c.base + c.bonus) * multiplier),
    };
  });
}

/** Is a candidate hidden by a stored state? Done/dismissed: until the fingerprint changes. Snoozed: until the date, or a change. */
export function isSuppressed(
  c: Pick<Candidate, "ruleKey" | "subjectKey" | "fingerprint">,
  states: ActionState[],
  now: Date,
): boolean {
  const st = states.find(
    (s) => s.ruleKey === c.ruleKey && s.subjectKey === c.subjectKey,
  );
  if (!st || st.status === "open" || st.fingerprint !== c.fingerprint)
    return false;
  if (st.status === "snoozed")
    return !!st.snoozedUntil && st.snoozedUntil.getTime() > now.getTime();
  return true;
}

/** Today: top N actions by score, with a stable tie-break (rule order, then subject). */
export function rankActions(book: Book): Candidate[] {
  const order = new Map(TODAY_RULES.map((r, i) => [r, i]));
  return candidates(book)
    .filter((c) => !isSuppressed(c, book.states, book.now))
    .sort(
      (a, b) =>
        b.score - a.score ||
        order.get(a.ruleKey)! - order.get(b.ruleKey)! ||
        a.subjectKey.localeCompare(b.subjectKey),
    )
    .slice(0, Math.max(0, Math.floor(book.settings["today.topN"])));
}
