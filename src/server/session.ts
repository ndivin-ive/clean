import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/domain/permissions";
import type { AppLocale } from "@/i18n/routing";
import { getAuth } from "./auth";
import { getDb } from "./db/client";
import { authSession, authUser, membership } from "./db/schema";
import { withUser, type TenantContext } from "./db/tenant";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  theme: "light" | "dark" | "system";
  language: "en" | "fr";
}
export interface CurrentMember extends CurrentUser {
  organizationId: string;
  roles: Role[];
  ctx: TenantContext;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const [prefs] = await getDb()
    .select({ theme: authUser.theme, language: authUser.language })
    .from(authUser)
    .where(eq(authUser.id, session.user.id));
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    sessionId: session.session.id,
    theme: prefs?.theme ?? "light",
    language: prefs?.language ?? "en",
  };
}

export async function requireUser(locale: AppLocale): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return user;
}

/** Active organisation of this session, validated against an active membership (RLS: own memberships only). */
export async function getCurrentMember(): Promise<CurrentMember | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = getDb();
  const [row] = await db
    .select({ org: authSession.activeOrganizationId })
    .from(authSession)
    .where(eq(authSession.id, user.sessionId));
  if (!row?.org) return null;
  const orgId = row.org;
  const [m] = await withUser(db, user.id, (tx) =>
    tx
      .select({ roles: membership.roles })
      .from(membership)
      .where(
        and(
          eq(membership.organizationId, orgId),
          eq(membership.userId, user.id),
          eq(membership.isActive, true),
        ),
      ),
  );
  if (!m) return null;
  return {
    ...user,
    organizationId: orgId,
    roles: m.roles as Role[],
    ctx: { organizationId: orgId, userId: user.id },
  };
}

export async function requireMember(locale: AppLocale): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) redirect(`/${locale}/start`);
  return member;
}
