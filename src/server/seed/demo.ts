import { asc, eq } from "drizzle-orm";
import { DEFAULT_STAGES } from "@/domain/settings/defaults";
import { toIsoDate } from "@/domain/time";
import type { Database } from "../db/client";
import * as s from "../db/schema";
import { withTenant } from "../db/tenant";
import { createOrganization } from "../services/organizations";
import {
  DEMO_ACCOUNTS,
  DEMO_DEALS,
  DEMO_EVIDENCE,
  DEMO_INTERACTIONS,
  DEMO_MEETINGS,
  DEMO_ORG,
  DEMO_PEOPLE,
  DEMO_PLANS,
  DEMO_RECENT_EVENTS,
  DEMO_SIGNALS,
  DEMO_STEPS,
  DEMO_USERS,
  qualOf,
} from "./demo-data";

export interface DemoIds {
  organizationId: string;
  users: Record<keyof typeof DEMO_USERS, string>;
  accounts: Record<string, string>;
  people: Record<string, string>;
  deals: Record<string, string>;
}

const DAY = 86_400_000;

/**
 * Seed the invented demo organisation into a database whose demo data has been
 * cleared. Everything is written through `withTenant`, as the record's owner,
 * so row-level security and the audit trail apply exactly as in the app.
 */
export async function seedDemo(
  db: Database,
  now = new Date(),
): Promise<DemoIds> {
  const at = (days: number) => new Date(now.getTime() + days * DAY);
  const day = (days: number) => toIsoDate(at(days));

  // Users (global identity table).
  const users = {} as DemoIds["users"];
  for (const [key, u] of Object.entries(DEMO_USERS) as [
    keyof typeof DEMO_USERS,
    (typeof DEMO_USERS)[keyof typeof DEMO_USERS],
  ][]) {
    const [row] = await db
      .insert(s.authUser)
      .values({ name: u.name, email: u.email, emailVerified: true })
      .returning({ id: s.authUser.id });
    users[key] = row!.id;
  }

  // Organisation created by the admin with all defaults, then the team.
  const organizationId = await createOrganization(
    db,
    users.admin,
    { name: DEMO_ORG.name, defaultLanguage: "en" },
    DEMO_ORG.id,
  );
  await withTenant(db, { organizationId, userId: users.admin }, async (tx) => {
    await tx
      .update(s.membership)
      .set({ roles: [...DEMO_USERS.admin.roles] })
      .where(eq(s.membership.userId, users.admin));
    await tx
      .insert(s.membership)
      .values({ userId: users.manager, roles: [...DEMO_USERS.manager.roles] });
    await tx.insert(s.membership).values([
      {
        userId: users.seller,
        roles: [...DEMO_USERS.seller.roles],
        managerUserId: users.manager,
      },
      {
        userId: users.peer,
        roles: [...DEMO_USERS.peer.roles],
        managerUserId: users.manager,
      },
    ]);
  });

  // The seller's book, written as the seller.
  const ids = await withTenant(
    db,
    { organizationId, userId: users.seller },
    async (tx) => {
      const stageRows = await tx
        .select({ id: s.pipelineStage.id })
        .from(s.pipelineStage)
        .orderBy(asc(s.pipelineStage.sortOrder));
      const stage = Object.fromEntries(
        DEFAULT_STAGES.map((st, i) => [st.key, stageRows[i]!.id]),
      ) as Record<(typeof DEFAULT_STAGES)[number]["key"], string>;

      const accounts: Record<string, string> = {};
      for (const a of DEMO_ACCOUNTS) {
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
      for (const p of DEMO_PEOPLE) {
        const [row] = await tx
          .insert(s.person)
          .values({
            accountId: accounts[p.account]!,
            name: p.name,
            title: p.title,
            department: p.department,
            email: `${p.name
              .toLowerCase()
              .normalize("NFD")
              .replace(/[^a-z ]/g, "")
              .replace(
                / +/g,
                ".",
              )}@${DEMO_ACCOUNTS.find((a) => a.key === p.account)!.domain}`,
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
      const order = [
        "lead",
        "discovery",
        "solution",
        "proposal",
        "negotiation",
      ] as const;
      for (const d of DEMO_DEALS) {
        const [row] = await tx
          .insert(s.deal)
          .values({
            accountId: accounts[d.account]!,
            name: d.name,
            amount: d.amount,
            stageId: stage[d.stage],
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
        const qual = qualOf(d.qual);
        await tx.insert(s.dealQualification).values(
          Object.entries(qual).map(([criterionKey, status]) => ({
            dealId,
            criterionKey,
            status,
            evidence:
              DEMO_EVIDENCE.find(
                (e) => e.deal === d.key && e.criterion === criterionKey,
              )?.text ?? null,
          })),
        );
        // Stage history: walk the path, the last move at stage entry, earlier moves 12 days apart.
        const path: string[] =
          d.stage === "won"
            ? [...order, "won"]
            : d.stage === "lost"
              ? [
                  ...order.slice(
                    0,
                    order.indexOf(
                      (d.lostFrom ?? "lead") as (typeof order)[number],
                    ) + 1,
                  ),
                  "lost",
                ]
              : order.slice(0, order.indexOf(d.stage) + 1);
        await tx.insert(s.dealEvent).values(
          path.map((to, i) => ({
            dealId,
            kind: "stage" as const,
            fromValue: i ? stage[path[i - 1] as keyof typeof stage] : null,
            toValue: stage[to as keyof typeof stage],
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
      for (const e of DEMO_RECENT_EVENTS)
        await tx.insert(s.dealEvent).values({
          dealId: deals[e.deal]!,
          kind: e.kind,
          fromValue: e.from,
          toValue: e.to,
          occurredAt: at(-e.daysAgo),
        });
      for (const st of DEMO_STEPS)
        await tx.insert(s.closePlanStep).values({
          dealId: deals[st.deal]!,
          title: st.title,
          stepOwner: st.owner,
          dueDate: day(st.dueInDays),
          doneAt: st.done ? at(st.dueInDays) : null,
        });

      // Interactions: notable ones, plus a check-in for every last contact not already covered.
      const covered = new Set(
        DEMO_INTERACTIONS.flatMap((i) =>
          i.people.map((p) => `${p}@${i.daysAgo}`),
        ),
      );
      const generated = DEMO_PEOPLE.filter(
        (p) =>
          p.lastDaysAgo !== null && !covered.has(`${p.key}@${p.lastDaysAgo}`),
      ).map((p) => ({
        account: p.account,
        deal:
          DEMO_DEALS.find(
            (d) =>
              d.account === p.account &&
              d.stakeholders.some(([k]) => k === p.key),
          )?.key ?? null,
        type: "call" as const,
        daysAgo: p.lastDaysAgo!,
        people: [p.key],
        summary: `Check-in call with ${p.name}.`,
      }));
      for (const i of [...DEMO_INTERACTIONS, ...generated]) {
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
      for (const m of DEMO_MEETINGS) {
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

      for (const g of DEMO_SIGNALS)
        await tx.insert(s.signal).values({
          accountId: accounts[g.account]!,
          personId: g.person ? people[g.person]! : null,
          type: g.type,
          title: g.title,
          detectedAt: at(-g.daysAgo),
          relevance: g.relevance,
        });
      for (const p of DEMO_PLANS) {
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

  return { organizationId, users, ...ids };
}
