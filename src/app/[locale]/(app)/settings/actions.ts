"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { authSession, authUser } from "@/server/db/schema";
import { asLocale } from "@/server/navigation";
import { requireUser } from "@/server/session";

export async function setLanguage(formData: FormData) {
  const current = asLocale(String(formData.get("locale")));
  const user = await requireUser(current);
  const next = asLocale(String(formData.get("language")));
  await getDb()
    .update(authUser)
    .set({ language: next })
    .where(eq(authUser.id, user.id));
  revalidatePath("/[locale]", "layout"); // the root layout carries lang and theme
  redirect(`/${next}/settings`);
}

export async function setTheme(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const user = await requireUser(locale);
  const raw = String(formData.get("theme"));
  const theme = raw === "dark" || raw === "system" ? raw : "light";
  await getDb().update(authUser).set({ theme }).where(eq(authUser.id, user.id));
  revalidatePath("/[locale]", "layout");
  redirect(`/${locale}/settings`);
}

/** Clear the active organisation so the user can pick another one. */
export async function switchOrganization(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const user = await requireUser(locale);
  await getDb()
    .update(authSession)
    .set({ activeOrganizationId: null })
    .where(eq(authSession.id, user.sessionId));
  revalidatePath("/[locale]", "layout");
  redirect(`/${locale}/start`);
}
