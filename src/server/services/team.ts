import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { assertCan, type Role } from "@/domain/permissions";
import type { Database } from "../db/client";
import * as s from "../db/schema";
import { withTenant, withUser, type TenantContext } from "../db/tenant";

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const INVITE_DAYS = 7;

export async function listMembers(
  db: Database,
  ctx: TenantContext,
  roles: readonly Role[],
) {
  assertCan(roles, "team.view");
  return withTenant(db, ctx, async (tx) => ({
    members: await tx
      .select({
        userId: s.membership.userId,
        name: s.authUser.name,
        email: s.authUser.email,
        roles: s.membership.roles,
        managerUserId: s.membership.managerUserId,
        isActive: s.membership.isActive,
      })
      .from(s.membership)
      .innerJoin(s.authUser, eq(s.authUser.id, s.membership.userId))
      .orderBy(s.authUser.name),
    invitations: await tx
      .select({
        id: s.invitation.id,
        email: s.invitation.email,
        roles: s.invitation.roles,
        expiresAt: s.invitation.expiresAt,
      })
      .from(s.invitation)
      .where(isNull(s.invitation.acceptedAt))
      .orderBy(s.invitation.createdAt),
    organization: (
      await tx
        .select({
          name: s.organization.name,
          teamVisibility: s.organization.teamVisibility,
        })
        .from(s.organization)
        .where(eq(s.organization.id, ctx.organizationId))
    )[0]!,
  }));
}

/** Create an invitation. Returns the raw token (sent by email, never stored — only its SHA-256 is). */
export async function inviteMember(
  db: Database,
  ctx: TenantContext,
  roles: readonly Role[],
  input: { email: string; roles: Role[] },
): Promise<{ token: string; organizationName: string }> {
  assertCan(roles, "team.invite");
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error("Invalid email");
  const inviteRoles = input.roles.length ? input.roles : (["seller"] as Role[]);
  const token = randomBytes(32).toString("base64url");
  const organizationName = await withTenant(db, ctx, async (tx) => {
    await tx.insert(s.invitation).values({
      email,
      roles: inviteRoles,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    });
    return (
      await tx
        .select({ name: s.organization.name })
        .from(s.organization)
        .where(eq(s.organization.id, ctx.organizationId))
    )[0]!.name;
  });
  return { token, organizationName };
}

export type AcceptResult =
  | { ok: true; organizationId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "wrong_email" };

/** Accept an invitation through the SECURITY DEFINER function (the invitee has no tenant yet). */
export async function acceptInvitation(
  db: Database,
  userId: string,
  token: string,
): Promise<AcceptResult> {
  return withUser(db, userId, async (tx) => {
    const res = await tx.execute<{ org: string | null; reason: string | null }>(
      sql`SELECT org, reason FROM accept_invitation(${hashToken(token)}, ${userId}::uuid)`,
    );
    const row = res.rows[0];
    if (row?.org) return { ok: true, organizationId: row.org };
    return {
      ok: false,
      reason: (row?.reason ?? "invalid") as
        "invalid" | "expired" | "used" | "wrong_email",
    };
  });
}

export async function setTeamVisibility(
  db: Database,
  ctx: TenantContext,
  roles: readonly Role[],
  on: boolean,
): Promise<void> {
  assertCan(roles, "org.team_visibility");
  await withTenant(db, ctx, (tx) =>
    tx
      .update(s.organization)
      .set({ teamVisibility: on })
      .where(eq(s.organization.id, ctx.organizationId)),
  );
}

/** Change a member's roles and manager. An admin cannot remove their own admin role (no lock-out). */
export async function updateMember(
  db: Database,
  ctx: TenantContext,
  roles: readonly Role[],
  input: { userId: string; roles: Role[]; managerUserId: string | null },
): Promise<void> {
  assertCan(roles, "team.edit_roles");
  const nextRoles = [...new Set(input.roles)];
  if (!nextRoles.length) throw new Error("A member needs at least one role");
  if (input.userId === ctx.userId && !nextRoles.includes("admin"))
    throw new Error("You cannot remove your own admin role");
  if (input.managerUserId === input.userId)
    throw new Error("A member cannot manage themselves");
  await withTenant(db, ctx, (tx) =>
    tx
      .update(s.membership)
      .set({ roles: nextRoles, managerUserId: input.managerUserId })
      .where(
        and(
          eq(s.membership.userId, input.userId),
          eq(s.membership.organizationId, ctx.organizationId),
        ),
      ),
  );
}
