"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { asLocale } from "@/server/navigation";
import { selectOrganization } from "@/server/services/organizations";
import { acceptInvitation } from "@/server/services/team";
import { requireUser } from "@/server/session";

export async function acceptInvitationAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const token = String(formData.get("token") ?? "");
  const user = await requireUser(locale);
  const db = getDb();
  const result = await acceptInvitation(db, user.id, token);
  if (!result.ok)
    redirect(
      `/${locale}/invite/${encodeURIComponent(token)}?error=${result.reason}`,
    );
  await selectOrganization(db, user, result.organizationId);
  redirect(`/${locale}/today`);
}
