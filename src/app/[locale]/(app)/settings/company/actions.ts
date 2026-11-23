"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { updateQuoteSettings } from "@/server/services/quotes";
import { requireMember } from "@/server/session";

export async function saveCompanyAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const member = await requireMember(locale);
  const text = (k: string, max: number) =>
    String(formData.get(k) ?? "")
      .trim()
      .slice(0, max) || null;
  const validity = Number(formData.get("quoteValidityDays"));
  const vat = Number(
    String(formData.get("defaultVatRate") ?? "").replace(",", "."),
  );
  if (
    !(Number.isInteger(validity) && validity >= 1 && validity <= 365) ||
    !(vat >= 0 && vat <= 100)
  )
    redirect(`/${locale}/settings/company?error=invalid`);
  await updateQuoteSettings(getDb(), member.ctx, member.roles, {
    legalName: text("legalName", 200),
    legalAddress: text("legalAddress", 500),
    legalId: text("legalId", 40),
    vatNumber: text("vatNumber", 40),
    quoteTerms: text("quoteTerms", 8000),
    quoteValidityDays: validity,
    defaultVatRate: vat,
  });
  redirect(`/${locale}/settings/company?saved=1`);
}
