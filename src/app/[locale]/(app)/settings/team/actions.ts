"use server";

import { redirect } from "next/navigation";
import { ForbiddenError, type Role } from "@/domain/permissions";
import { getDb } from "@/server/db/client";
import { invitationEmail } from "@/server/mail/templates";
import { sendMail } from "@/server/mail/transport";
import { asLocale } from "@/server/navigation";
import {
  inviteMember,
  setTeamVisibility,
  updateMember,
} from "@/server/services/team";
import { requireMember } from "@/server/session";

const ROLES: Role[] = ["seller", "manager", "admin", "specialist"];
const rolesFrom = (fd: FormData) =>
  fd
    .getAll("roles")
    .map(String)
    .filter((r): r is Role => (ROLES as string[]).includes(r));

function errorCode(e: unknown): string {
  if (e instanceof ForbiddenError) return "forbidden";
  const msg = e instanceof Error ? e.message : "";
  if (/email/i.test(msg)) return "invalidEmail";
  if (/own admin/i.test(msg)) return "ownAdmin";
  return "error";
}

export async function inviteAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const member = await requireMember(locale);
  const email = String(formData.get("email") ?? "");
  let ok = false;
  try {
    const { token, organizationName } = await inviteMember(
      getDb(),
      member.ctx,
      member.roles,
      { email, roles: rolesFrom(formData) },
    );
    const base =
      process.env.BETTER_AUTH_URL ??
      process.env.APP_URL ??
      "http://localhost:3000";
    const msg = await invitationEmail(
      locale,
      `${base}/${locale}/invite/${token}`,
      organizationName,
      member.name || member.email,
    );
    await sendMail({ to: email.trim().toLowerCase(), ...msg });
    ok = true;
  } catch (e) {
    redirect(`/${locale}/settings/team?error=${errorCode(e)}`);
  }
  if (ok)
    redirect(
      `/${locale}/settings/team?invited=${encodeURIComponent(email.trim().toLowerCase())}`,
    );
}

export async function visibilityAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const member = await requireMember(locale);
  try {
    await setTeamVisibility(
      getDb(),
      member.ctx,
      member.roles,
      formData.get("teamVisibility") === "on",
    );
  } catch (e) {
    redirect(`/${locale}/settings/team?error=${errorCode(e)}`);
  }
  redirect(`/${locale}/settings/team?saved=1`);
}

export async function updateMemberAction(formData: FormData) {
  const locale = asLocale(String(formData.get("locale")));
  const member = await requireMember(locale);
  const manager = String(formData.get("managerUserId") ?? "");
  try {
    await updateMember(getDb(), member.ctx, member.roles, {
      userId: String(formData.get("userId")),
      roles: rolesFrom(formData),
      managerUserId: manager || null,
    });
  } catch (e) {
    redirect(`/${locale}/settings/team?error=${errorCode(e)}`);
  }
  redirect(`/${locale}/settings/team?saved=1`);
}
