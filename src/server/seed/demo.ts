import { asc, eq } from "drizzle-orm";
import { salesProfile } from "@/domain/profiles";
import { toIsoDate } from "@/domain/time";
import type { Database } from "../db/client";
import * as s from "../db/schema";
import { withTenant } from "../db/tenant";
import { createOrganization } from "../services/organizations";
import {
  createQuote,
  getQuote,
  getQuoteByToken,
  respondToQuote,
  saveQuoteDraft,
  sendQuote,
} from "../services/quotes";
import { LUMEN_DEMO, qualOf, type DemoDataset } from "./demo-data";

export interface DemoIds {
  organizationId: string;
  users: Record<keyof DemoDataset["users"], string>;
  accounts: Record<string, string>;
  people: Record<string, string>;
  deals: Record<string, string>;
}

const DAY = 86_400_000;

/**
 * Seed one invented demo organisation (a dataset) into a database whose
 * previous copy has been cleared. Everything is written through `withTenant`,
 * as the record's owner, so row-level security and the audit trail apply
 * exactly as in the app. Stages and criteria come from the dataset's profile.
 */
export async function seedDemo(
  db: Database,
  data: DemoDataset = LUMEN_DEMO,
  now = new Date(),
): Promise<DemoIds> {
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  const day = (days: number) => toIsoDate(at(days));
  const profile = salesProfile(data.org.salesProfile);

  const users = {} as DemoIds["users"];
  for (const key of Object.keys(data.users) as (keyof DemoDataset["users"])[]) {
    const u = data.users[key];
    const [row] = await db
      .insert(s.authUser)
      .values({
        name: u.name,
        email: u.email,
        emailVerified: true,
        language: data.org.defaultLanguage,
      })
      .returning({ id: s.authUser.id });
    users[key] = row!.id;
  }

  const organizationId = await createOrganization(
    db,
    users.admin,
    {
      name: data.org.name,
      defaultLanguage: data.org.defaultLanguage,
      salesProfile: profile.key,
      brand: data.org.brand ?? null,
    },
    data.org.id,
  );
  await withTenant(db, { organizationId, userId: users.admin }, async (tx) => {
    await tx
      .update(s.membership)
      .set({ roles: [...data.users.admin.roles] })
      .where(eq(s.membership.userId, users.admin));
    await tx
      .insert(s.membership)
      .values({ userId: users.manager, roles: [...data.users.manager.roles] });
    await tx.insert(s.membership).values([
      {
        userId: users.seller,
        roles: [...data.users.seller.roles],
        managerUserId: users.manager,
      },
      {
        userId: users.peer,
        roles: [...data.users.peer.roles],
        managerUserId: users.manager,
      },
    ]);
  });

  const ids = await withTenant(
    db,
    { organizationId, userId: users.seller },
    async (tx) => {
      const stageRows = await tx
        .select({ id: s.pipelineStage.id })
        .from(s.pipelineStage)
        .orderBy(asc(s.pipelineStage.sortOrder));
      const stage: Record<string, string> = Object.fromEntries(
        profile.stages.map((st, i) => [st.key, stageRows[i]!.id]),
      );
      const openKeys = profile.stages
        .filter((st) => !st.isWon && !st.isLost)
        .map((st) => st.key);
      const wonKey = profile.stages.find((st) => st.isWon)!.key;
      const lostKey = profile.stages.find((st) => st.isLost)!.key;
      const criteriaKeys = profile.criteria.map((c) => c.key);

      const accounts: Record<string, string> = {};
      for (const a of data.accounts) {
        const [row] = await tx
          .insert(s.account)
          .values({
            name: a.name,
            domain: a.domain,
            country: a.country,
            industry: a.industry,
            segment: a.segment,
            tier: a.tier,
            relationship: a.relationship,
            annualValue: a.annualValue,
            renewalDate: a.renewalInDays === null ? null : day(a.renewalInDays),
            nextReviewDate: a.tier === "key" ? day(14) : null,
          })
          .returning({ id: s.account.id });
        accounts[a.key] = row!.id;
      }

      const people: Record<string, string> = {};
      for (const p of data.people) {
        const domain = data.accounts.find((a) => a.key === p.account)!.domain;
        const local = p.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[^a-z ]/g, "")
          .replace(/ +/g, ".");
        const [row] = await tx
          .insert(s.person)
          .values({
            accountId: accounts[p.account]!,
            name: p.name,
            title: p.title,
            department: p.department,
            email: `${local}@${domain}`,
          })
          .returning({ id: s.person.id });
        people[p.key] = row!.id;
        await tx.insert(s.relationship).values({
          personId: row!.id,
          decisionRole: p.role,
          stance: p.stance,
          strength: p.strength,
          lastInteractionAt: p.lastDaysAgo === null ? null : at(-p.lastDaysAgo),
        });
      }

      const deals: Record<string, string> = {};
      for (const d of data.deals) {
        const [row] = await tx
          .insert(s.deal)
          .values({
            accountId: accounts[d.account]!,
            name: d.name,
            amount: d.amount,
            stageId: stage[d.stage]!,
            closeDate: day(d.closeInDays),
            compellingEvent: d.compellingEvent,
            nextStep: d.nextStep,
            nextStepDate:
              d.nextStepInDays === null ? null : day(d.nextStepInDays),
            forecastCategory: d.forecast,
            stageEnteredAt: at(-d.daysInStage),
          })
          .returning({ id: s.deal.id });
        const dealId = row!.id;
        deals[d.key] = dealId;
        await tx.insert(s.dealStakeholder).values(
          d.stakeholders.map(([p, role]) => ({
            dealId,
            personId: people[p]!,
            roleInDeal: role,
          })),
        );
        const qual = qualOf(d.qual, criteriaKeys);
        await tx.insert(s.dealQualification).values(
          Object.entries(qual).map(([criterionKey, status]) => ({
            dealId,
            criterionKey,
            status,
            evidence:
              data.evidence.find(
                (e) => e.deal === d.key && e.criterion === criterionKey,
              )?.text ?? null,
          })),
        );
        // Stage history: walk the path, the last move at stage entry, earlier moves 12 days apart.
        const path: string[] =
          d.stage === wonKey
            ? [...openKeys, wonKey]
            : d.stage === lostKey
              ? [
                  ...openKeys.slice(
                    0,
                    openKeys.indexOf(d.lostFrom ?? openKeys[0]!) + 1,
                  ),
                  lostKey,
                ]
              : openKeys.slice(0, openKeys.indexOf(d.stage) + 1);
        await tx.insert(s.dealEvent).values(
          path.map((to, i) => ({
            dealId,
            kind: "stage" as const,
            fromValue: i ? stage[path[i - 1]!]! : null,
            toValue: stage[to]!,
            occurredAt: at(-d.daysInStage - (path.length - 1 - i) * 12),
          })),
        );
        for (let k = d.pushes; k >= 1; k--) {
          await tx.insert(s.dealEvent).values({
            dealId,
            kind: "close_date",
            fromValue: day(d.closeInDays - 14 * k),
            toValue: day(d.closeInDays - 14 * (k - 1)),
            occurredAt: at(-7 * k - 3),
          });
        }
      }
      for (const e of data.recentEvents)
        await tx.insert(s.dealEvent).values({
          dealId: deals[e.deal]!,
          kind: e.kind,
          fromValue: e.from,
          toValue: e.to,
          occurredAt: at(-e.daysAgo),
        });
      for (const st of data.steps)
        await tx.insert(s.closePlanStep).values({
          dealId: deals[st.deal]!,
          title: st.title,
          stepOwner: st.owner,
          dueDate: day(st.dueInDays),
          doneAt: st.done ? at(st.dueInDays) : null,
        });

      // Interactions: notable ones, plus a check-in for every last contact not already covered.
      const covered = new Set(
        data.interactions.flatMap((i) =>
          i.people.map((p) => `${p}@${i.daysAgo}`),
        ),
      );
      const checkIn =
        data.org.defaultLanguage === "fr"
          ? (n: string) => `Point téléphonique avec ${n}.`
          : (n: string) => `Check-in call with ${n}.`;
      const generated = data.people
        .filter(
          (p) =>
            p.lastDaysAgo !== null && !covered.has(`${p.key}@${p.lastDaysAgo}`),
        )
        .map((p) => ({
          account: p.account,
          deal:
            data.deals.find(
              (d) =>
                d.account === p.account &&
                d.stakeholders.some(([k]) => k === p.key),
            )?.key ?? null,
          type: "call" as const,
          daysAgo: p.lastDaysAgo!,
          people: [p.key],
          summary: checkIn(p.name),
        }));
      for (const i of [...data.interactions, ...generated]) {
        const [row] = await tx
          .insert(s.interaction)
          .values({
            accountId: accounts[i.account]!,
            dealId: i.deal ? deals[i.deal]! : null,
            type: i.type,
            occurredAt: at(-i.daysAgo),
            summary: i.summary,
            source: "manual",
          })
          .returning({ id: s.interaction.id });
        await tx.insert(s.interactionParticipant).values([
          { interactionId: row!.id, userId: users.seller },
          ...i.people.map((p) => ({
            interactionId: row!.id,
            personId: people[p]!,
          })),
        ]);
      }
      for (const m of data.meetings) {
        const start = new Date(
          Math.round((now.getTime() + m.inHours * 3_600_000) / 3_600_000) *
            3_600_000,
        );
        const [row] = await tx
          .insert(s.interaction)
          .values({
            accountId: accounts[m.account]!,
            dealId: m.deal ? deals[m.deal]! : null,
            type: "meeting",
            occurredAt: start,
            title: m.title,
            source: "manual",
          })
          .returning({ id: s.interaction.id });
        await tx.insert(s.interactionParticipant).values([
          { interactionId: row!.id, userId: users.seller },
          ...m.people.map((p) => ({
            interactionId: row!.id,
            personId: people[p]!,
          })),
        ]);
      }

      for (const g of data.signals)
        await tx.insert(s.signal).values({
          accountId: accounts[g.account]!,
          personId: g.person ? people[g.person]! : null,
          type: g.type,
          title: g.title,
          detectedAt: at(-g.daysAgo),
          relevance: g.relevance,
        });
      for (const p of data.plans) {
        await tx.insert(s.accountPlan).values({
          accountId: accounts[p.account]!,
          objectives: p.objectives,
          ourGoals: p.ourGoals,
          whitespace: p.whitespace,
          risks: p.risks.map((text) => ({ text, createdAt: day(-30) })),
          valueDelivered: p.value.map((v) => ({
            date: day(-v.daysAgo),
            text: v.text,
          })),
          nextMoves: p.nextMoves,
          lastReviewedAt: at(-p.reviewedDaysAgo),
        });
      }
      return { accounts, people, deals };
    },
  );

  if (data.org.legal)
    await withTenant(db, { organizationId, userId: users.admin }, (tx) =>
      tx
        .update(s.organization)
        .set(data.org.legal!)
        .where(eq(s.organization.id, organizationId)),
    );
  if (data.quotes?.length)
    await seedQuotes(
      db,
      data,
      { organizationId, userId: users.seller },
      ids.deals,
      now,
    );

  return { organizationId, users, ...ids };
}

/** Demo quotes go through the real quote service (numbering, freezing, customer answer). */
async function seedQuotes(
  db: Database,
  data: DemoDataset,
  ctx: { organizationId: string; userId: string },
  deals: Record<string, string>,
  now: Date,
) {
  const seller = data.users.seller;
  for (const q of data.quotes ?? []) {
    const sentAt =
      q.status === "draft"
        ? now
        : new Date(now.getTime() - (q.sentDaysAgo ?? 0) * DAY);
    const id = await createQuote(db, ctx, deals[q.deal]!, sentAt);
    const current = (await getQuote(db, ctx, id))!;
    await saveQuoteDraft(db, ctx, id, {
      title: current.title,
      language: current.language,
      validUntil: current.validUntil,
      introduction: q.introduction ?? null,
      terms: current.terms,
      recipientName: current.recipientName,
      recipientEmail: current.recipientEmail,
      lines: q.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit ?? null,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct ?? 0,
        vatRate: 20,
        productKey: l.productKey ?? null,
      })),
    });
    if (q.status === "draft") continue;
    const { token } = await sendQuote(
      db,
      ctx,
      id,
      { name: seller.name, email: seller.email },
      sentAt,
    );
    if (q.viewed || q.status !== "sent") await getQuoteByToken(db, token);
    if (q.status === "accepted" || q.status === "declined")
      await respondToQuote(db, token, {
        decision: q.status,
        name: q.responder?.name ?? "",
        title: q.responder?.title ?? null,
        reason: q.responder?.reason ?? null,
      });
  }
}
