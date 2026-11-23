import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { assertCan, type Role } from "@/domain/permissions";
import {
  addDaysIso,
  canEdit,
  canRevise,
  formatQuoteNumber,
  lineProblems,
  quoteTotals,
  sendProblems,
  type QuoteLineInput,
  type QuoteStatus,
  type SendProblem,
} from "@/domain/quotes";
import type { Database } from "../db/client";
import * as s from "../db/schema";
import { withTenant, type TenantContext } from "../db/tenant";
import { hashToken } from "./team";

/*
 * Quotes (D-060). Every seller-side function works inside withTenant AND
 * filters on owner_id = me (like accounts, D-053): a quote is the seller's
 * own document even when team visibility lets a manager read more.
 * The customer side goes through quote_by_token / respond_to_quote only.
 */

export class QuoteError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "not_editable"
      | "not_revisable"
      | "invalid_line"
      | "cannot_send"
      | "revision_exists",
    public readonly problems: SendProblem[] = [],
  ) {
    super(code);
    this.name = "QuoteError";
  }
}

const today = (now: Date) => now.toISOString().slice(0, 10);
const newToken = () => randomBytes(32).toString("base64url");

export interface QuoteDraftInput {
  title: string;
  language: "en" | "fr";
  validUntil: string;
  introduction: string | null;
  terms: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  lines: QuoteLineInput[];
}

/** Quote settings and seller identity of the organisation. */
export async function getQuoteSettings(db: Database, ctx: TenantContext) {
  return withTenant(db, ctx, async (tx) => {
    const [o] = await tx
      .select({
        name: s.organization.name,
        legalName: s.organization.legalName,
        legalAddress: s.organization.legalAddress,
        legalId: s.organization.legalId,
        vatNumber: s.organization.vatNumber,
        quoteTerms: s.organization.quoteTerms,
        quoteValidityDays: s.organization.quoteValidityDays,
        defaultVatRate: s.organization.defaultVatRate,
        defaultLanguage: s.organization.defaultLanguage,
        salesProfile: s.organization.salesProfile,
        brandColor: s.organization.brandColor,
        brandInk: s.organization.brandInk,
      })
      .from(s.organization)
      .where(eq(s.organization.id, ctx.organizationId));
    return o!;
  });
}

export async function updateQuoteSettings(
  db: Database,
  ctx: TenantContext,
  roles: readonly Role[],
  input: {
    legalName: string | null;
    legalAddress: string | null;
    legalId: string | null;
    vatNumber: string | null;
    quoteTerms: string | null;
    quoteValidityDays: number;
    defaultVatRate: number;
  },
) {
  assertCan(roles, "org.settings");
  await withTenant(db, ctx, (tx) =>
    tx
      .update(s.organization)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(s.organization.id, ctx.organizationId)),
  );
}

/** My open deals with the account and their quotes (Deals screen). */
export async function listDealsWithQuotes(db: Database, ctx: TenantContext) {
  return withTenant(db, ctx, async (tx) => {
    const deals = await tx
      .select({
        id: s.deal.id,
        name: s.deal.name,
        amount: s.deal.amount,
        currency: s.deal.currency,
        closeDate: s.deal.closeDate,
        accountId: s.account.id,
        accountName: s.account.name,
        stageNameEn: s.pipelineStage.nameEn,
        stageNameFr: s.pipelineStage.nameFr,
        stageOrder: s.pipelineStage.sortOrder,
        isWon: s.pipelineStage.isWon,
        isLost: s.pipelineStage.isLost,
      })
      .from(s.deal)
      .innerJoin(s.account, eq(s.account.id, s.deal.accountId))
      .innerJoin(s.pipelineStage, eq(s.pipelineStage.id, s.deal.stageId))
      .where(eq(s.deal.ownerId, ctx.userId))
      .orderBy(asc(s.pipelineStage.sortOrder), desc(s.deal.amount));
    const quotes = deals.length
      ? await tx
          .select({
            id: s.quote.id,
            dealId: s.quote.dealId,
            number: s.quote.number,
            revision: s.quote.revision,
            status: s.quote.status,
            total: s.quote.total,
            subtotal: s.quote.subtotal,
            currency: s.quote.currency,
            validUntil: s.quote.validUntil,
            viewedAt: s.quote.viewedAt,
            updatedAt: s.quote.updatedAt,
          })
          .from(s.quote)
          .where(
            and(
              eq(s.quote.ownerId, ctx.userId),
              inArray(
                s.quote.dealId,
                deals.map((d) => d.id),
              ),
            ),
          )
          .orderBy(desc(s.quote.createdAt))
      : [];
    return deals.map((d) => ({
      ...d,
      quotes: quotes.filter((q) => q.dealId === d.id),
    }));
  });
}

/** One of my quotes, with lines, deal and account names. */
export async function getQuote(db: Database, ctx: TenantContext, id: string) {
  return withTenant(db, ctx, async (tx) => {
    const [q] = await tx
      .select({
        quote: s.quote,
        dealName: s.deal.name,
        dealStageId: s.deal.stageId,
        accountName: s.account.name,
      })
      .from(s.quote)
      .innerJoin(s.deal, eq(s.deal.id, s.quote.dealId))
      .innerJoin(s.account, eq(s.account.id, s.quote.accountId))
      .where(and(eq(s.quote.id, id), eq(s.quote.ownerId, ctx.userId)));
    if (!q) return null;
    const lines = await tx
      .select()
      .from(s.quoteLine)
      .where(eq(s.quoteLine.quoteId, id))
      .orderBy(asc(s.quoteLine.sortOrder), asc(s.quoteLine.createdAt));
    const [stage] = await tx
      .select({ isWon: s.pipelineStage.isWon, isLost: s.pipelineStage.isLost })
      .from(s.pipelineStage)
      .where(eq(s.pipelineStage.id, q.dealStageId));
    const [newer] = q.quote.number
      ? await tx
          .select({
            id: s.quote.id,
            revision: s.quote.revision,
            status: s.quote.status,
          })
          .from(s.quote)
          .where(
            and(
              eq(s.quote.ownerId, ctx.userId),
              eq(s.quote.number, q.quote.number),
              sql`${s.quote.revision} > ${q.quote.revision}`,
            ),
          )
          .orderBy(desc(s.quote.revision))
          .limit(1)
      : [];
    return {
      ...q.quote,
      dealName: q.dealName,
      accountName: q.accountName,
      dealWon: !!stage?.isWon,
      dealClosed: !!(stage?.isWon || stage?.isLost),
      newerRevision: newer ?? null,
      lines,
    };
  });
}

/**
 * New draft quote for one of my deals, prefilled from the deal and the
 * organisation defaults: one line for the deal amount, validity, terms,
 * language and the buyer-side contact as recipient.
 */
export async function createQuote(
  db: Database,
  ctx: TenantContext,
  dealId: string,
  now = new Date(),
): Promise<string> {
  const settings = await getQuoteSettings(db, ctx);
  return withTenant(db, ctx, async (tx) => {
    const [d] = await tx
      .select()
      .from(s.deal)
      .where(and(eq(s.deal.id, dealId), eq(s.deal.ownerId, ctx.userId)));
    if (!d) throw new QuoteError("not_found");
    const contacts = await tx
      .select({
        name: s.person.name,
        email: s.person.email,
        role: s.dealStakeholder.roleInDeal,
      })
      .from(s.dealStakeholder)
      .innerJoin(s.person, eq(s.person.id, s.dealStakeholder.personId))
      .where(eq(s.dealStakeholder.dealId, dealId));
    const rank = (r: string) =>
      ["economic_buyer", "decision_maker", "procurement", "champion"].indexOf(
        r,
      ) + 1 || 9;
    const recipient = [...contacts].sort(
      (a, b) => rank(a.role) - rank(b.role),
    )[0];
    const [q] = await tx
      .insert(s.quote)
      .values({
        dealId,
        accountId: d.accountId,
        title: d.name,
        language: settings.defaultLanguage,
        currency: d.currency,
        validUntil: addDaysIso(now, settings.quoteValidityDays),
        terms: settings.quoteTerms,
        recipientName: recipient?.name ?? null,
        recipientEmail: recipient?.email ?? null,
      })
      .returning({ id: s.quote.id });
    const line: QuoteLineInput = {
      description: d.name,
      quantity: 1,
      unitPrice: d.amount ?? 0,
      discountPct: 0,
      vatRate: settings.defaultVatRate,
    };
    await tx
      .insert(s.quoteLine)
      .values({ quoteId: q!.id, sortOrder: 1, ...line });
    const t = quoteTotals([line]);
    await tx
      .update(s.quote)
      .set({ subtotal: t.subtotal, vatTotal: t.vatTotal, total: t.total })
      .where(eq(s.quote.id, q!.id));
    return q!.id;
  });
}

async function ownQuote(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  ctx: TenantContext,
  id: string,
) {
  const [q] = await tx
    .select()
    .from(s.quote)
    .where(and(eq(s.quote.id, id), eq(s.quote.ownerId, ctx.userId)))
    .for("update");
  if (!q) throw new QuoteError("not_found");
  return q;
}

/** Save a draft: header fields and the full list of lines (replaced). */
export async function saveQuoteDraft(
  db: Database,
  ctx: TenantContext,
  id: string,
  input: QuoteDraftInput,
): Promise<void> {
  const lines = input.lines.filter(
    (l) => l.description.trim() || l.unitPrice || l.quantity !== 1,
  );
  if (lines.some((l) => lineProblems(l).length))
    throw new QuoteError("invalid_line");
  const title = input.title.trim();
  if (!title) throw new QuoteError("invalid_line");
  await withTenant(db, ctx, async (tx) => {
    const q = await ownQuote(tx, ctx, id);
    if (!canEdit(q.status)) throw new QuoteError("not_editable");
    await tx.delete(s.quoteLine).where(eq(s.quoteLine.quoteId, id));
    if (lines.length)
      await tx.insert(s.quoteLine).values(
        lines.map((l, i) => ({
          quoteId: id,
          sortOrder: i + 1,
          description: l.description.trim(),
          quantity: l.quantity,
          unit: l.unit?.trim() || null,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct,
          vatRate: l.vatRate,
          productKey: l.productKey || null,
        })),
      );
    const t = quoteTotals(lines);
    await tx
      .update(s.quote)
      .set({
        title,
        language: input.language,
        validUntil: input.validUntil,
        introduction: input.introduction?.trim() || null,
        terms: input.terms?.trim() || null,
        recipientName: input.recipientName?.trim() || null,
        recipientEmail: input.recipientEmail?.trim() || null,
        subtotal: t.subtotal,
        vatTotal: t.vatTotal,
        total: t.total,
      })
      .where(eq(s.quote.id, id));
  });
}

/**
 * Send a draft: checks completeness, assigns the number (first version),
 * freezes the seller identity, creates the customer link and marks the
 * previous version superseded. Returns the link token, shown once: only its
 * hash is stored.
 */
export async function sendQuote(
  db: Database,
  ctx: TenantContext,
  id: string,
  seller: { name: string; email: string },
  now = new Date(),
): Promise<{ token: string; reference: string }> {
  const settings = await getQuoteSettings(db, ctx);
  return withTenant(db, ctx, async (tx) => {
    const q = await ownQuote(tx, ctx, id);
    if (!canEdit(q.status)) throw new QuoteError("not_editable");
    const lines = await tx
      .select()
      .from(s.quoteLine)
      .where(eq(s.quoteLine.quoteId, id));
    const problems = sendProblems({
      lines,
      validUntil: q.validUntil,
      today: today(now),
      seller: settings,
    });
    if (problems.length) throw new QuoteError("cannot_send", problems);
    let number = q.number;
    if (!number) {
      const year = now.getUTCFullYear();
      const [seq] = await tx
        .insert(s.quoteSequence)
        .values({ year, lastNumber: 1 })
        .onConflictDoUpdate({
          target: [s.quoteSequence.organizationId, s.quoteSequence.year],
          set: { lastNumber: sql`${s.quoteSequence.lastNumber} + 1` },
        })
        .returning({ n: s.quoteSequence.lastNumber });
      number = formatQuoteNumber(year, seq!.n);
    }
    const token = newToken();
    const t = quoteTotals(lines);
    await tx
      .update(s.quote)
      .set({
        number,
        status: "sent",
        sentAt: now,
        tokenHash: hashToken(token),
        subtotal: t.subtotal,
        vatTotal: t.vatTotal,
        total: t.total,
        sellerSnapshot: {
          legalName: settings.legalName,
          legalAddress: settings.legalAddress,
          legalId: settings.legalId,
          vatNumber: settings.vatNumber,
          sellerName: seller.name,
          sellerEmail: seller.email,
          // Brand colours (D-058) so the customer page looks like the seller's.
          brandColor: settings.brandColor,
          brandInk: settings.brandInk,
        },
      })
      .where(eq(s.quote.id, id));
    if (q.revision > 1)
      await tx
        .update(s.quote)
        .set({ status: "superseded", supersededBy: id })
        .where(
          and(
            eq(s.quote.ownerId, ctx.userId),
            eq(s.quote.number, number),
            lt(s.quote.revision, q.revision),
            inArray(s.quote.status, ["sent", "declined"]),
          ),
        );
    return {
      token,
      reference: q.revision > 1 ? `${number}-v${q.revision}` : number,
    };
  });
}

/** Replace the customer link of a sent quote (the old link stops working). */
export async function renewQuoteLink(
  db: Database,
  ctx: TenantContext,
  id: string,
): Promise<string> {
  return withTenant(db, ctx, async (tx) => {
    const q = await ownQuote(tx, ctx, id);
    if (q.status !== "sent") throw new QuoteError("not_editable");
    const token = newToken();
    await tx
      .update(s.quote)
      .set({ tokenHash: hashToken(token) })
      .where(eq(s.quote.id, id));
    return token;
  });
}

/** New draft version of a sent or declined quote (same number, revision + 1). */
export async function reviseQuote(
  db: Database,
  ctx: TenantContext,
  id: string,
  now = new Date(),
): Promise<string> {
  const settings = await getQuoteSettings(db, ctx);
  return withTenant(db, ctx, async (tx) => {
    const q = await ownQuote(tx, ctx, id);
    if (!canRevise(q.status)) throw new QuoteError("not_revisable");
    const [existing] = await tx
      .select({ id: s.quote.id })
      .from(s.quote)
      .where(
        and(
          eq(s.quote.ownerId, ctx.userId),
          eq(s.quote.number, q.number!),
          sql`${s.quote.revision} > ${q.revision}`,
        ),
      );
    if (existing) throw new QuoteError("revision_exists");
    const [copy] = await tx
      .insert(s.quote)
      .values({
        dealId: q.dealId,
        accountId: q.accountId,
        number: q.number,
        revision: q.revision + 1,
        title: q.title,
        language: q.language,
        currency: q.currency,
        validUntil: addDaysIso(now, settings.quoteValidityDays),
        introduction: q.introduction,
        terms: q.terms,
        recipientName: q.recipientName,
        recipientEmail: q.recipientEmail,
        subtotal: q.subtotal,
        vatTotal: q.vatTotal,
        total: q.total,
      })
      .returning({ id: s.quote.id });
    const lines = await tx
      .select()
      .from(s.quoteLine)
      .where(eq(s.quoteLine.quoteId, id));
    if (lines.length)
      await tx.insert(s.quoteLine).values(
        lines.map((l) => ({
          quoteId: copy!.id,
          sortOrder: l.sortOrder,
          productKey: l.productKey,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct,
          vatRate: l.vatRate,
        })),
      );
    return copy!.id;
  });
}

export async function deleteQuoteDraft(
  db: Database,
  ctx: TenantContext,
  id: string,
) {
  await withTenant(db, ctx, async (tx) => {
    const q = await ownQuote(tx, ctx, id);
    if (!canEdit(q.status)) throw new QuoteError("not_editable");
    await tx.delete(s.quote).where(eq(s.quote.id, id));
  });
}

/**
 * The seller's decision after the customer accepted (rule 3): move the deal
 * to the won stage and set its amount to the quote's net total, recording
 * both changes as deal events.
 */
export async function markDealWonFromQuote(
  db: Database,
  ctx: TenantContext,
  quoteId: string,
): Promise<void> {
  await withTenant(db, ctx, async (tx) => {
    const q = await ownQuote(tx, ctx, quoteId);
    if (q.status !== "accepted") throw new QuoteError("not_editable");
    const [d] = await tx
      .select()
      .from(s.deal)
      .where(and(eq(s.deal.id, q.dealId), eq(s.deal.ownerId, ctx.userId)));
    const [won] = await tx
      .select({ id: s.pipelineStage.id })
      .from(s.pipelineStage)
      .where(eq(s.pipelineStage.isWon, true))
      .limit(1);
    if (!d || !won || d.stageId === won.id) return;
    await tx
      .update(s.deal)
      .set({ stageId: won.id, stageEnteredAt: new Date(), amount: q.subtotal })
      .where(eq(s.deal.id, d.id));
    await tx.insert(s.dealEvent).values([
      { dealId: d.id, kind: "stage", fromValue: d.stageId, toValue: won.id },
      ...(d.amount !== q.subtotal
        ? [
            {
              dealId: d.id,
              kind: "amount" as const,
              fromValue: d.amount == null ? null : String(d.amount),
              toValue: String(q.subtotal),
            },
          ]
        : []),
    ]);
  });
}

/* ── customer side (no account, no tenant context) ─────────────────────── */

export interface PublicQuoteLine {
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountPct: number;
  vatRate: number;
}
export interface PublicQuote {
  status: QuoteStatus;
  language: "en" | "fr";
  number?: string;
  revision?: number;
  title?: string;
  currency?: string;
  validUntil?: string;
  introduction?: string | null;
  terms?: string | null;
  recipientName?: string | null;
  subtotal?: number;
  vatTotal?: number;
  total?: number;
  seller?: {
    legalName: string | null;
    legalAddress: string | null;
    legalId: string | null;
    vatNumber: string | null;
    sellerName: string;
    sellerEmail: string;
    brandColor?: string | null;
    brandInk?: string | null;
  };
  sentAt?: string;
  respondedAt?: string | null;
  responderName?: string | null;
  responderTitle?: string | null;
  declineReason?: string | null;
  customer?: string;
  lines?: PublicQuoteLine[];
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export async function getQuoteByToken(
  db: Database,
  token: string,
): Promise<PublicQuote | null> {
  if (!TOKEN_RE.test(token)) return null;
  const r = await db.execute<{ q: PublicQuote | null }>(
    sql`SELECT quote_by_token(${hashToken(token)}) AS q`,
  );
  const q = r.rows[0]?.q ?? null;
  if (!q) return null;
  // numeric columns arrive as numbers in jsonb; keep them numeric
  return q;
}

export type RespondResult =
  "ok" | "invalid" | "closed" | "expired" | "name_required";

export async function respondToQuote(
  db: Database,
  token: string,
  input: {
    decision: "accepted" | "declined";
    name: string;
    title: string | null;
    reason: string | null;
  },
): Promise<RespondResult> {
  if (!TOKEN_RE.test(token)) return "invalid";
  const r = await db.execute<{ r: RespondResult }>(
    sql`SELECT respond_to_quote(${hashToken(token)}, ${input.decision}, ${input.name}, ${input.title}, ${input.reason}) AS r`,
  );
  return r.rows[0]!.r;
}
