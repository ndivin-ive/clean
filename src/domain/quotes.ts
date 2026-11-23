/**
 * Quotes (D-060): pure calculation and lifecycle rules, no framework or DB.
 * Amounts are rounded to the cent on each line (net and VAT), then summed, so
 * the document always adds up exactly as printed.
 */

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "superseded",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
/** What the seller and customer see: a sent quote past its validity date is "expired". */
export type QuoteDisplayStatus = QuoteStatus | "expired";

export interface QuoteLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  vatRate: number;
  unit?: string | null;
  productKey?: string | null;
}

export interface LineAmounts {
  gross: number;
  discount: number;
  net: number;
  vat: number;
}

export interface QuoteTotals {
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  /** VAT by rate, as French invoices and quotes show it. */
  vatByRate: { rate: number; base: number; vat: number }[];
}

export const roundCents = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export function lineAmounts(l: QuoteLineInput): LineAmounts {
  const gross = roundCents(l.quantity * l.unitPrice);
  const net = roundCents(gross * (1 - l.discountPct / 100));
  return {
    gross,
    discount: roundCents(gross - net),
    net,
    vat: roundCents((net * l.vatRate) / 100),
  };
}

export function quoteTotals(lines: readonly QuoteLineInput[]): QuoteTotals {
  const byRate = new Map<number, { base: number; vat: number }>();
  let subtotal = 0;
  let discountTotal = 0;
  let vatTotal = 0;
  for (const l of lines) {
    const a = lineAmounts(l);
    subtotal = roundCents(subtotal + a.net);
    discountTotal = roundCents(discountTotal + a.discount);
    vatTotal = roundCents(vatTotal + a.vat);
    const r = byRate.get(l.vatRate) ?? { base: 0, vat: 0 };
    byRate.set(l.vatRate, {
      base: roundCents(r.base + a.net),
      vat: roundCents(r.vat + a.vat),
    });
  }
  return {
    subtotal,
    discountTotal,
    vatTotal,
    total: roundCents(subtotal + vatTotal),
    vatByRate: [...byRate.entries()]
      .sort(([a], [b]) => b - a)
      .map(([rate, v]) => ({ rate, ...v })),
  };
}

export type LineProblem =
  "description" | "quantity" | "unitPrice" | "discountPct" | "vatRate";

/** Problems that block saving a line (the database enforces the same rules). */
export function lineProblems(l: QuoteLineInput): LineProblem[] {
  const out: LineProblem[] = [];
  if (!l.description.trim()) out.push("description");
  if (!(Number.isFinite(l.quantity) && l.quantity > 0)) out.push("quantity");
  if (!(Number.isFinite(l.unitPrice) && l.unitPrice >= 0))
    out.push("unitPrice");
  if (!(
    Number.isFinite(l.discountPct) &&
    l.discountPct >= 0 &&
    l.discountPct <= 100
  ))
    out.push("discountPct");
  if (!(Number.isFinite(l.vatRate) && l.vatRate >= 0 && l.vatRate <= 100))
    out.push("vatRate");
  return out;
}

export type SendProblem =
  "no_lines" | "invalid_line" | "zero_total" | "seller_identity" | "expired";

/**
 * Checks before a draft can be sent. A quote needs at least one valid line, a
 * positive total, a validity date not in the past, and the seller's legal
 * identity (name and address) so the document is complete.
 */
export function sendProblems(input: {
  lines: readonly QuoteLineInput[];
  validUntil: string;
  today: string;
  seller: { legalName?: string | null; legalAddress?: string | null };
}): SendProblem[] {
  const out: SendProblem[] = [];
  if (!input.lines.length) out.push("no_lines");
  else if (input.lines.some((l) => lineProblems(l).length))
    out.push("invalid_line");
  else if (quoteTotals(input.lines).total <= 0) out.push("zero_total");
  if (input.validUntil < input.today) out.push("expired");
  if (!input.seller.legalName?.trim() || !input.seller.legalAddress?.trim())
    out.push("seller_identity");
  return out;
}

export function displayStatus(
  status: QuoteStatus,
  validUntil: string,
  today: string,
): QuoteDisplayStatus {
  return status === "sent" && validUntil < today ? "expired" : status;
}

export const canEdit = (status: QuoteStatus) => status === "draft";
/** A new version can be made from a sent (not yet answered) or declined quote. */
export const canRevise = (status: QuoteStatus) =>
  status === "sent" || status === "declined";

/** "DEV-2026-0042", plus "-v2" from the second revision. */
export function quoteReference(
  number: string | null,
  revision: number,
): string | null {
  if (!number) return null;
  return revision > 1 ? `${number}-v${revision}` : number;
}

export const formatQuoteNumber = (year: number, n: number) =>
  `DEV-${year}-${String(n).padStart(4, "0")}`;

/** ISO date `days` after `from` (UTC calendar day). */
export function addDaysIso(from: Date, days: number): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
