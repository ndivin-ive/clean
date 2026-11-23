"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { respondToQuote } from "@/server/services/quotes";

/** Customer answer to a quote (no account; the link token is the authority). */
export async function respondAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const token = String(formData.get("token") ?? "");
  const decision =
    formData.get("decision") === "declined" ? "declined" : "accepted";
  const page = `/${locale}/q/${encodeURIComponent(token)}`;
  if (decision === "accepted" && formData.get("agree") !== "1")
    redirect(`${page}?error=agree`);
  const result = await respondToQuote(getDb(), token, {
    decision,
    name: String(formData.get("name") ?? "").slice(0, 200),
    title: String(formData.get("title") ?? "").slice(0, 200) || null,
    reason: String(formData.get("reason") ?? "").slice(0, 2000) || null,
  });
  redirect(result === "ok" ? page : `${page}?error=${result}`);
}
