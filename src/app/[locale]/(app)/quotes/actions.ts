"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { sendMail } from "@/server/mail/transport";
import { quoteEmail } from "@/server/mail/templates";
import { asLocale } from "@/server/navigation";
import {
  createQuote,
  deleteQuoteDraft,
  getQuote,
  markDealWonFromQuote,
  QuoteError,
  renewQuoteLink,
  reviseQuote,
  saveQuoteDraft,
  sendQuote,
  type QuoteDraftInput,
} from "@/server/services/quotes";
import { requireMember } from "@/server/session";

const base = () =>
  process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
const ID = /^[0-9a-f-]{36}$/i;

/** The customer link is shown once (only its hash is stored): carried to the page in a short-lived, httpOnly cookie. */
async function flashLink(locale: string, id: string, url: string) {
  (await cookies()).set(`quote_link_${id}`, url, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: `/${locale}/quotes/${id}`,
  });
}

function read(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const id = String(formData.get("id") ?? "");
  if (!ID.test(id)) redirect(`/${locale}/deals`);
  return { locale, id };
}

function draftFrom(formData: FormData): QuoteDraftInput {
  const raw = JSON.parse(String(formData.get("payload") ?? "{}")) as Record<
    string,
    unknown
  >;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const n = (v: unknown) => (typeof v === "number" ? v : Number.NaN);
  const lines = Array.isArray(raw.lines)
    ? (raw.lines as Record<string, unknown>[])
    : [];
  return {
    title: str(raw.title).slice(0, 200),
    language: raw.language === "en" ? "en" : "fr",
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(str(raw.validUntil))
      ? str(raw.validUntil)
      : "",
    introduction: str(raw.introduction).slice(0, 4000) || null,
    terms: str(raw.terms).slice(0, 8000) || null,
    recipientName: str(raw.recipientName).slice(0, 200) || null,
    recipientEmail: str(raw.recipientEmail).slice(0, 320) || null,
    lines: lines.slice(0, 200).map((l) => ({
      description: str(l.description).slice(0, 500),
      quantity: n(l.quantity),
      unit: str(l.unit).slice(0, 20) || null,
      unitPrice: n(l.unitPrice),
      discountPct: n(l.discountPct),
      vatRate: n(l.vatRate),
      productKey: str(l.productKey).slice(0, 60) || null,
    })),
  };
}

const code = (e: unknown) => (e instanceof QuoteError ? e.code : "other");

export async function createQuoteAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const member = await requireMember(locale);
  const dealId = String(formData.get("dealId") ?? "");
  if (!ID.test(dealId)) redirect(`/${locale}/deals`);
  const id = await createQuote(getDb(), member.ctx, dealId);
  redirect(`/${locale}/quotes/${id}`);
}

export async function saveQuoteAction(formData: FormData) {
  const { locale, id } = read(formData);
  const member = await requireMember(locale);
  let target = `/${locale}/quotes/${id}?saved=1`;
  try {
    const input = draftFrom(formData);
    if (!input.validUntil) throw new QuoteError("invalid_line");
    await saveQuoteDraft(getDb(), member.ctx, id, input);
  } catch (e) {
    target = `/${locale}/quotes/${id}?error=${code(e)}`;
  }
  redirect(target);
}

export async function sendQuoteAction(formData: FormData) {
  const { locale, id } = read(formData);
  const member = await requireMember(locale);
  const db = getDb();
  let target: string;
  try {
    const input = draftFrom(formData);
    if (!input.validUntil) throw new QuoteError("invalid_line");
    await saveQuoteDraft(db, member.ctx, id, input);
    const { token, reference } = await sendQuote(db, member.ctx, id, {
      name: member.name || member.email,
      email: member.email,
    });
    const url = `${base()}/${input.language}/q/${token}`;
    await flashLink(locale, id, url);
    target = `/${locale}/quotes/${id}?sent=1`;
    if (formData.get("email") === "1" && input.recipientEmail) {
      const q = await getQuote(db, member.ctx, id);
      const msg = await quoteEmail(input.language, {
        url,
        reference,
        title: q!.title,
        seller:
          (q!.sellerSnapshot as { legalName?: string } | null)?.legalName ?? "",
        total: q!.total,
        currency: q!.currency,
        validUntil: q!.validUntil,
      });
      await sendMail({ to: input.recipientEmail, ...msg });
      target += `&emailed=${encodeURIComponent(input.recipientEmail)}`;
    }
  } catch (e) {
    if (e instanceof QuoteError && e.code === "cannot_send")
      target = `/${locale}/quotes/${id}?problems=${e.problems.join(",")}`;
    else target = `/${locale}/quotes/${id}?error=${code(e)}`;
  }
  redirect(target);
}

export async function deleteQuoteAction(formData: FormData) {
  const { locale, id } = read(formData);
  const member = await requireMember(locale);
  try {
    await deleteQuoteDraft(getDb(), member.ctx, id);
  } catch (e) {
    redirect(`/${locale}/quotes/${id}?error=${code(e)}`);
  }
  redirect(`/${locale}/deals`);
}

export async function renewLinkAction(formData: FormData) {
  const { locale, id } = read(formData);
  const member = await requireMember(locale);
  const db = getDb();
  let target = `/${locale}/quotes/${id}?renewed=1`;
  try {
    const token = await renewQuoteLink(db, member.ctx, id);
    const q = await getQuote(db, member.ctx, id);
    await flashLink(locale, id, `${base()}/${q!.language}/q/${token}`);
  } catch (e) {
    target = `/${locale}/quotes/${id}?error=${code(e)}`;
  }
  redirect(target);
}

export async function reviseQuoteAction(formData: FormData) {
  const { locale, id } = read(formData);
  const member = await requireMember(locale);
  let target: string;
  try {
    target = `/${locale}/quotes/${await reviseQuote(getDb(), member.ctx, id)}`;
  } catch (e) {
    target = `/${locale}/quotes/${id}?error=${code(e)}`;
  }
  redirect(target);
}

export async function markWonAction(formData: FormData) {
  const { locale, id } = read(formData);
  const member = await requireMember(locale);
  let target = `/${locale}/quotes/${id}?won=1`;
  try {
    await markDealWonFromQuote(getDb(), member.ctx, id);
  } catch (e) {
    target = `/${locale}/quotes/${id}?error=${code(e)}`;
  }
  redirect(target);
}
