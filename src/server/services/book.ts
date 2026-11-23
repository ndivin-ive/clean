import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { Book, TodayRule } from "@/domain/rules/today";
import { countCloseDatePushes } from "@/domain/rules/deal-health";
import { resolveRuleSettings } from "@/domain/settings/defaults";
import type {
  Account,
  Deal,
  DecisionRole,
  Meeting,
  Person,
  QualificationStatus,
  Signal,
  Stage,
} from "@/domain/types";
import type { Database } from "../db/client";
import * as s from "../db/schema";
import { withTenant, type TenantContext } from "../db/tenant";

/** Display data the UI needs next to the rules' output (names and labels by id). */
export interface BookLabels {
  stages: Map<string, { nameEn: string; nameFr: string }>;
  criteria: Map<string, { labelEn: string; labelFr: string }>;
  accounts: Map<string, string>;
  deals: Map<string, string>;
  people: Map<string, string>;
}

/**
 * Load the signed-in seller's own book and map it to the plain data the rules
 * engine reads. Runs inside withTenant, so RLS applies; the explicit owner
 * filter keeps Today personal even when team visibility lets a manager read more.
 */
export async function loadBook(
  db: Database,
  ctx: TenantContext,
  now = new Date(),
): Promise<{ book: Book; labels: BookLabels }> {
  const me = ctx.userId;
  return withTenant(db, ctx, async (tx) => {
    // One transaction = one connection: queries run one after another
    // (pg deprecates concurrent queries on a client).
    const [stageRows, criteriaRows, cadenceRows, settingRows, adjustmentRows] =
      await sequential([
        tx
          .select()
          .from(s.pipelineStage)
          .orderBy(asc(s.pipelineStage.sortOrder)),
        tx
          .select()
          .from(s.qualificationCriterion)
          .orderBy(asc(s.qualificationCriterion.sortOrder)),
        tx.select().from(s.roleCadence),
        tx
          .select({ key: s.ruleSetting.key, value: s.ruleSetting.value })
          .from(s.ruleSetting),
        tx
          .select()
          .from(s.userRuleAdjustment)
          .where(eq(s.userRuleAdjustment.ownerId, me)),
      ]);
    const accountRows = await tx
      .select()
      .from(s.account)
      .where(eq(s.account.ownerId, me));
    const peopleRows = await tx
      .select({
        id: s.person.id,
        accountId: s.person.accountId,
        name: s.person.name,
        role: s.relationship.decisionRole,
        stance: s.relationship.stance,
        strength: s.relationship.strength,
        last: s.relationship.lastInteractionAt,
      })
      .from(s.person)
      .leftJoin(
        s.relationship,
        and(
          eq(s.relationship.personId, s.person.id),
          eq(s.relationship.ownerId, me),
        ),
      )
      .where(eq(s.person.ownerId, me));
    const dealRows = await tx
      .select()
      .from(s.deal)
      .where(eq(s.deal.ownerId, me));
    const dealIds = dealRows.map((d) => d.id);
    const [stakeRows, qualRows, closeEvents] = dealIds.length
      ? await sequential([
          tx
            .select()
            .from(s.dealStakeholder)
            .where(inArray(s.dealStakeholder.dealId, dealIds)),
          tx
            .select()
            .from(s.dealQualification)
            .where(inArray(s.dealQualification.dealId, dealIds)),
          tx
            .select({
              dealId: s.dealEvent.dealId,
              kind: s.dealEvent.kind,
              fromValue: s.dealEvent.fromValue,
              toValue: s.dealEvent.toValue,
            })
            .from(s.dealEvent)
            .where(
              and(
                inArray(s.dealEvent.dealId, dealIds),
                eq(s.dealEvent.kind, "close_date"),
              ),
            ),
        ])
      : [[], [], []];
    const signalRows = await tx
      .select()
      .from(s.signal)
      .where(eq(s.signal.ownerId, me));
    const meetingRows = await tx
      .select({
        id: s.interaction.id,
        accountId: s.interaction.accountId,
        dealId: s.interaction.dealId,
        title: s.interaction.title,
        startsAt: s.interaction.occurredAt,
        viewedAt: s.meetingBrief.viewedAt,
      })
      .from(s.interaction)
      .leftJoin(
        s.meetingBrief,
        eq(s.meetingBrief.interactionId, s.interaction.id),
      )
      .where(
        and(
          eq(s.interaction.ownerId, me),
          eq(s.interaction.type, "meeting"),
          gt(s.interaction.occurredAt, now),
          lt(
            s.interaction.occurredAt,
            new Date(now.getTime() + 8 * 86_400_000),
          ),
        ),
      );
    const planRows = await tx
      .select({
        accountId: s.accountPlan.accountId,
        lastReviewedAt: s.accountPlan.lastReviewedAt,
        risks: s.accountPlan.risks,
      })
      .from(s.accountPlan)
      .where(eq(s.accountPlan.ownerId, me));
    const [pending] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.captureProposal)
      .where(
        and(
          eq(s.captureProposal.ownerId, me),
          eq(s.captureProposal.status, "pending"),
        ),
      );
    const stateRows = await tx
      .select()
      .from(s.action)
      .where(eq(s.action.ownerId, me));

    const stages: Stage[] = stageRows.map((r) => ({
      id: r.id,
      sortOrder: r.sortOrder,
      probability: r.probability,
      typicalDays: r.typicalDays,
      isWon: r.isWon,
      isLost: r.isLost,
    }));
    const accounts: Account[] = accountRows.map((r) => ({
      id: r.id,
      name: r.name,
      tier: r.tier,
      relationship: r.relationship,
      renewalDate: r.renewalDate,
    }));
    const people: Person[] = peopleRows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      name: r.name,
      role: (r.role ?? "unknown") as DecisionRole,
      stance: r.stance ?? "unknown",
      strength: r.strength ?? 1,
      lastInteractionAt: r.last,
    }));
    const deals: Deal[] = dealRows.map((d) => ({
      id: d.id,
      accountId: d.accountId,
      name: d.name,
      amount: d.amount ?? 0,
      stageId: d.stageId,
      stageEnteredAt: d.stageEnteredAt,
      closeDate: d.closeDate,
      nextStep: d.nextStep,
      nextStepDate: d.nextStepDate,
      forecastCategory: d.forecastCategory,
      compellingEvent: d.compellingEvent,
      closeDatePushes: countCloseDatePushes(
        closeEvents.filter((e) => e.dealId === d.id),
      ),
      stakeholders: stakeRows
        .filter((x) => x.dealId === d.id)
        .map((x) => ({
          personId: x.personId,
          role: x.roleInDeal as DecisionRole,
        })),
      qualification: Object.fromEntries(
        qualRows
          .filter((q) => q.dealId === d.id)
          .map((q) => [q.criterionKey, q.status as QualificationStatus]),
      ),
    }));
    const signals: Signal[] = signalRows.map((g) => ({
      id: g.id,
      accountId: g.accountId,
      type: g.type,
      title: g.title,
      detectedAt: g.detectedAt,
      relevance: g.relevance,
    }));
    const meetings: Meeting[] = meetingRows.map((m) => ({
      id: m.id,
      accountId: m.accountId,
      dealId: m.dealId,
      title: m.title ?? "",
      startsAt: m.startsAt,
      briefViewed: !!m.viewedAt,
    }));

    const book: Book = {
      now,
      settings: resolveRuleSettings(settingRows),
      stages,
      criteria: criteriaRows.map((c) => ({
        key: c.key,
        requiredLate: c.requiredLate,
      })),
      cadences: Object.fromEntries(cadenceRows.map((c) => [c.role, c.days])),
      accounts,
      people,
      deals,
      signals,
      meetings,
      plans: planRows.map((p) => ({
        accountId: p.accountId,
        lastReviewedAt: p.lastReviewedAt,
        openRisks: Array.isArray(p.risks) ? p.risks.length : 0,
      })),
      pendingProposals: pending?.n ?? 0,
      states: stateRows.map((a) => ({
        ruleKey: a.ruleKey,
        subjectKey: a.subjectKey,
        fingerprint: a.fingerprint,
        status: a.status,
        snoozedUntil: a.snoozedUntil,
      })),
      adjustments: Object.fromEntries(
        adjustmentRows.map((a) => [a.ruleKey as TodayRule, a.multiplier]),
      ),
    };
    const labels: BookLabels = {
      stages: new Map(
        stageRows.map((r) => [r.id, { nameEn: r.nameEn, nameFr: r.nameFr }]),
      ),
      criteria: new Map(
        criteriaRows.map((c) => [
          c.key,
          { labelEn: c.labelEn, labelFr: c.labelFr },
        ]),
      ),
      accounts: new Map(accounts.map((a) => [a.id, a.name])),
      deals: new Map(deals.map((d) => [d.id, d.name])),
      people: new Map(people.map((p) => [p.id, p.name])),
    };
    return { book, labels };
  });
}

/** Await query builders one at a time, keeping tuple types. */
async function sequential<T extends readonly unknown[]>(
  queries: readonly [...{ [K in keyof T]: PromiseLike<T[K]> }],
): Promise<T> {
  const out: unknown[] = [];
  for (const q of queries) out.push(await q);
  return out as unknown as T;
}
