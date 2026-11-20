"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { selectOrganization } from "@/server/services/organizations";
import { requireUser } from "@/server/session";

export async function chooseOrganization(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const user = await requireUser(locale);
  const ok = await selectOrganization(
    getDb(),
    user,
    String(formData.get("organizationId")),
  );
  redirect(ok ? `/${locale}/today` : `/${locale}/start`);
}
