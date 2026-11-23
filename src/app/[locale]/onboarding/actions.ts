"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { SALES_PROFILE_KEYS, type SalesProfileKey } from "@/domain/profiles";
import { asLocale } from "@/server/navigation";
import {
  createOrganization,
  selectOrganization,
} from "@/server/services/organizations";
import { requireUser } from "@/server/session";

export async function createOrganizationAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const user = await requireUser(locale);
  const name = String(formData.get("name") ?? "").trim();
  const defaultLanguage =
    formData.get("defaultLanguage") === "fr" ? "fr" : "en";
  const requested = String(formData.get("salesProfile") ?? "");
  const salesProfile: SalesProfileKey = (
    SALES_PROFILE_KEYS as readonly string[]
  ).includes(requested)
    ? (requested as SalesProfileKey)
    : "generic";
  if (!name) redirect(`/${locale}/onboarding?error=name`);
  const db = getDb();
  const orgId = await createOrganization(db, user.id, {
    name,
    defaultLanguage,
    salesProfile,
  });
  await selectOrganization(db, user, orgId);
  redirect(`/${locale}/today`);
}
