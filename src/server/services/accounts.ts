import { and, desc, eq, inArray } from "drizzle-orm";
import { assessAccount } from "@/domain/rules/account-health";
import type { Assessment } from "@/domain/rules/common";
import type { RoleCoverage } from "@/domain/rules/coverage";
import { assessDeal } from "@/domain/rules/deal-health";
import {
  candidates,
  isSuppressed,
  type Book,
  type Candidate,
} from "@/domain/rules/today";
import type { Deal } from "@/domain/types";
import type { Database } from "../db/client";
import * as s from "../db/schema";
import { withTenant, type TenantContext } from "../db/tenant";
import { loadBook, type BookLabels } from "./book";

export interface AccountOverview {
  id: string;
  name: string;
  tier: "key" | "growth" | "maintain";
  relationship: "prospect" | "customer";
  renewalDate: string | null;
  health: Assessment;
  nextAction: Candidate | null;
  openDeals: number;
  openPipeline: number;
}

const openDeal = (book: Book, d: Deal) => {
  const st = book.stages.find((x) => x.id === d.stageId);
  return !!st && !st.isWon && !st.isLost;
};

function healthOf(book: Book, accountId: string, now: Date) {
  const account = book.accounts.find((a) => a.id === accountId)!;
  return assessAccount(account, {
    now,
    people: book.people.filter((p) => p.accountId === accountId),
    signals: book.signals,
    plan: book.plans.find((p) => p.accountId === accountId) ?? null,
  });
}

/** Best visible action per account (same rules and suppression as Today). */
function nextActions(book: Book): Map<string, Candidate> {
  const best = new Map<string, Candidate>();
  for (const c of candidates(book)) {
    if (!c.accountId || isSuppressed(c, book.states, book.now)) continue;
    const cur = best.get(c.accountId);
    if (!cur || c.score > cur.score) best.set(c.accountId, c);
  }
  return best;
}

export async function listAccounts(
  db: Database,
  ctx: TenantContext,
  now = new Date(),
): Promise<{ accounts: AccountOverview[]; labels: BookLabels }> {
  const { book, labels } = await loadBook(db, ctx, now);
  const actions = nextActions(book);
  const accounts = book.accounts
    .map((a) => {
      const open = book.deals.filter(
        (d) => d.accountId === a.id && openDeal(book, d),
      );
      return {
        id: a.id,
        name: a.name,
        tier: a.tier,
        relationship: a.relationship,
        renewalDate: a.renewalDate,
        health: healthOf(book, a.id, now),
        nextAction: actions.get(a.id) ?? null,
        openDeals: open.length,
        openPipeline: open.reduce((sum, d) => sum + d.amount, 0),
      };
    })
    .sort(
      (x, y) =>
        (x.tier === "key" ? 0 : 1) - (y.tier === "key" ? 0 : 1) ||
        x.name.localeCompare(y.name),
    );
  return { accounts, labels };
}

export interface AccountDetail {
  account: typeof s.account.$inferSelect;
  health: Assessment & { coverage: RoleCoverage[] };
  nextAction: Candidate | null;
  people: {
    id: string;
    name: string;
    title: string | null;
    department: string | null;
    email: string | null;
    role: string;
    stance: string;
    strength: number;
    lastInteractionAt: Date | null;
  }[];
  deals: {
    id: string;
    name: string;
    amount: number;
    stageId: string;
    closeDate: string | null;
    forecastCategory: string | null;
    open: boolean;
    health: Assessment | null;
  }[];
  interactions: {
    id: string;
    type: string;
    occurredAt: Date;
    title: string | null;
    summary: string;
    people: string[];
  }[];
  signals: { id: string; type: string; title: string; detectedAt: Date }[];
  plan: { lastReviewedAt: Date | null; risks: number } | null;
  labels: BookLabels;
}

/** Everything the account page shows, or null if the account is not the seller's (RLS + owner filter). */
export async function getAccountDetail(
  db: Database,
  ctx: TenantContext,
  accountId: string,
  now = new Date(),
): Promise<AccountDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return null;
  const { book, labels } = await loadBook(db, ctx, now);
  if (!book.accounts.some((a) => a.id === accountId)) return null;
  return withTenant(db, ctx, async (tx) => {
    const [account] = await tx
      .select()
      .from(s.account)
      .where(
        and(eq(s.account.id, accountId), eq(s.account.ownerId, ctx.userId)),
      );
    if (!account) return null;
    const personRows = await tx
      .select()
      .from(s.person)
      .where(eq(s.person.accountId, accountId))
      .orderBy(s.person.name);
    const interactionRows = await tx
      .select()
      .from(s.interaction)
      .where(eq(s.interaction.accountId, accountId))
      .orderBy(desc(s.interaction.occurredAt));
    const participants = interactionRows.length
      ? await tx
          .select({
            interactionId: s.interactionParticipant.interactionId,
            name: s.person.name,
          })
          .from(s.interactionParticipant)
          .innerJoin(
            s.person,
            eq(s.person.id, s.interactionParticipant.personId),
          )
          .where(
            inArray(
              s.interactionParticipant.interactionId,
              interactionRows.map((i) => i.id),
            ),
          )
      : [];
    const stages = new Map(book.stages.map((st) => [st.id, st]));
    const peopleById = new Map(book.people.map((p) => [p.id, p]));
    const health = healthOf(book, accountId, now);
    return {
      account,
      health,
      nextAction: nextActions(book).get(accountId) ?? null,
      people: personRows.map((p) => {
        const r = peopleById.get(p.id);
        return {
          id: p.id,
          name: p.name,
          title: p.title,
          department: p.department,
          email: p.email,
          role: r?.role ?? "unknown",
          stance: r?.stance ?? "unknown",
          strength: r?.strength ?? 1,
          lastInteractionAt: r?.lastInteractionAt ?? null,
        };
      }),
      deals: book.deals
        .filter((d) => d.accountId === accountId)
        .map((d) => {
          const st = stages.get(d.stageId)!;
          const open = !st.isWon && !st.isLost;
          return {
            id: d.id,
            name: d.name,
            amount: d.amount,
            stageId: d.stageId,
            closeDate: d.closeDate,
            forecastCategory: d.forecastCategory,
            open,
            health: open
              ? assessDeal(d, {
                  now,
                  stage: st,
                  criteria: book.criteria,
                  people: peopleById,
                })
              : null,
          };
        })
        .sort(
          (a, b) =>
            Number(b.open) - Number(a.open) ||
            (a.closeDate ?? "").localeCompare(b.closeDate ?? ""),
        ),
      interactions: interactionRows.map((i) => ({
        id: i.id,
        type: i.type,
        occurredAt: i.occurredAt,
        title: i.title,
        summary: i.summary,
        people: participants
          .filter((x) => x.interactionId === i.id)
          .map((x) => x.name),
      })),
      signals: book.signals
        .filter((g) => g.accountId === accountId)
        .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
        .map((g) => ({
          id: g.id,
          type: g.type,
          title: g.title,
          detectedAt: g.detectedAt,
        })),
      plan: (() => {
        const p = book.plans.find((x) => x.accountId === accountId);
        return p
          ? { lastReviewedAt: p.lastReviewedAt, risks: p.openRisks }
          : null;
      })(),
      labels,
    };
  });
}
