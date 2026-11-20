import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/permissions";
import {
  DEFAULT_CRITERIA,
  DEFAULT_RULE_SETTINGS,
  DEFAULT_STAGES,
} from "@/domain/settings/defaults";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import {
  createOrganization,
  listMyOrganizations,
  selectOrganization,
} from "@/server/services/organizations";
import {
  acceptInvitation,
  hashToken,
  inviteMember,
  listMembers,
  setTeamVisibility,
  updateMember,
} from "@/server/services/team";
import { appDb, closePools, ownerPool } from "./support/db";

async function user(email = `u-${randomUUID().slice(0, 8)}@example.test`) {
  const [u] = await appDb
    .insert(s.authUser)
    .values({ name: email.split("@")[0]!, email })
    .returning();
  const [session] = await appDb
    .insert(s.authSession)
    .values({
      userId: u!.id,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    .returning();
  return { id: u!.id, email, sessionId: session!.id };
}

let admin: Awaited<ReturnType<typeof user>>;
let orgId: string;
const ctx = () => ({ organizationId: orgId, userId: admin.id });

beforeAll(async () => {
  admin = await user();
  orgId = await createOrganization(appDb, admin.id, {
    name: "Lumen Data",
    defaultLanguage: "fr",
  });
});
afterAll(closePools);

describe("create organisation", () => {
  it("makes the creator admin and seller", async () => {
    expect(await listMyOrganizations(appDb, admin.id)).toEqual([
      { id: orgId, name: "Lumen Data", roles: ["admin", "seller"] },
    ]);
  });
  it("seeds default stages, criteria, cadences, rule settings, flags and AI off", async () => {
    const counts = await withTenant(appDb, ctx(), async (tx) => ({
      stages: (await tx.select().from(s.pipelineStage)).length,
      criteria: (await tx.select().from(s.qualificationCriterion)).length,
      cadences: (await tx.select().from(s.roleCadence)).length,
      rules: (await tx.select().from(s.ruleSetting)).length,
      flags: await tx
        .select({ key: s.featureFlag.key, enabled: s.featureFlag.enabled })
        .from(s.featureFlag),
      ai: await tx
        .select({ provider: s.aiProviderSetting.provider })
        .from(s.aiProviderSetting),
    }));
    expect(counts).toEqual({
      stages: DEFAULT_STAGES.length,
      criteria: DEFAULT_CRITERIA.length,
      cadences: 3,
      rules: Object.keys(DEFAULT_RULE_SETTINGS).length,
      flags: [{ key: "support_requests", enabled: false }],
      ai: [{ provider: "off" }],
    });
  });
  it("rejects a blank name", async () => {
    await expect(
      createOrganization(appDb, admin.id, {
        name: "  ",
        defaultLanguage: "en",
      }),
    ).rejects.toThrow();
  });
});

describe("select organisation", () => {
  it("sets the session's active organisation for a member", async () => {
    expect(await selectOrganization(appDb, admin, orgId)).toBe(true);
    const [row] = await appDb
      .select({ org: s.authSession.activeOrganizationId })
      .from(s.authSession)
      .where(eq(s.authSession.id, admin.sessionId));
    expect(row?.org).toBe(orgId);
  });
  it("refuses an organisation the user does not belong to", async () => {
    const stranger = await user();
    expect(await selectOrganization(appDb, stranger, orgId)).toBe(false);
  });
});

describe("invitations", () => {
  it("invite → accept with the invited email creates the membership with the invited roles", async () => {
    const invitee = await user();
    const { token, organizationName } = await inviteMember(
      appDb,
      ctx(),
      ["admin"],
      { email: invitee.email.toUpperCase(), roles: ["seller", "manager"] },
    );
    expect(organizationName).toBe("Lumen Data");
    expect(await acceptInvitation(appDb, invitee.id, token)).toEqual({
      ok: true,
      organizationId: orgId,
    });
    const orgs = await listMyOrganizations(appDb, invitee.id);
    expect(orgs).toEqual([
      { id: orgId, name: "Lumen Data", roles: ["seller", "manager"] },
    ]);
  });
  it("stores only the token hash", async () => {
    const { token } = await inviteMember(appDb, ctx(), ["admin"], {
      email: "hash@example.test",
      roles: [],
    });
    const { rows } = await ownerPool.query(
      "SELECT token_hash FROM invitation WHERE email = 'hash@example.test'",
    );
    expect(rows[0].token_hash).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });
  it("refuses someone signed in with another email", async () => {
    const { token } = await inviteMember(appDb, ctx(), ["admin"], {
      email: "right@example.test",
      roles: [],
    });
    const wrong = await user("wrong@example.test");
    expect(await acceptInvitation(appDb, wrong.id, token)).toEqual({
      ok: false,
      reason: "wrong_email",
    });
  });
  it("cannot be used twice", async () => {
    const invitee = await user();
    const { token } = await inviteMember(appDb, ctx(), ["admin"], {
      email: invitee.email,
      roles: [],
    });
    await acceptInvitation(appDb, invitee.id, token);
    expect(await acceptInvitation(appDb, invitee.id, token)).toEqual({
      ok: false,
      reason: "used",
    });
  });
  it("expires", async () => {
    const invitee = await user();
    const { token } = await inviteMember(appDb, ctx(), ["admin"], {
      email: invitee.email,
      roles: [],
    });
    await ownerPool.query(
      "UPDATE invitation SET expires_at = now() - interval '1 minute' WHERE token_hash = $1",
      [hashToken(token)],
    );
    expect(await acceptInvitation(appDb, invitee.id, token)).toEqual({
      ok: false,
      reason: "expired",
    });
  });
  it("rejects an unknown token", async () => {
    expect(await acceptInvitation(appDb, admin.id, "nope")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
  it("the function refuses to act for another user than the session's", async () => {
    const invitee = await user();
    const { token } = await inviteMember(appDb, ctx(), ["admin"], {
      email: invitee.email,
      roles: [],
    });
    const res = await withTenant(
      appDb,
      { organizationId: orgId, userId: admin.id },
      (tx) =>
        tx.execute<{ reason: string }>(
          sql`SELECT reason FROM accept_invitation(${hashToken(token)}, ${invitee.id}::uuid)`,
        ),
    );
    expect(res.rows[0]?.reason).toBe("invalid");
  });
  it("only admins can invite", async () => {
    await expect(
      inviteMember(appDb, ctx(), ["seller", "manager"], {
        email: "x@example.test",
        roles: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("team administration", () => {
  it("lists members and pending invitations for admins and managers, not sellers", async () => {
    const data = await listMembers(appDb, ctx(), ["manager"]);
    expect(data.members.length).toBeGreaterThanOrEqual(2);
    expect(data.invitations.every((i) => i.email)).toBe(true);
    await expect(listMembers(appDb, ctx(), ["seller"])).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
  it("team visibility is admin-only", async () => {
    await setTeamVisibility(appDb, ctx(), ["admin"], true);
    expect(
      (await listMembers(appDb, ctx(), ["admin"])).organization.teamVisibility,
    ).toBe(true);
    await expect(
      setTeamVisibility(appDb, ctx(), ["manager"], false),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await setTeamVisibility(appDb, ctx(), ["admin"], false);
  });
  it("an admin cannot remove their own admin role, and nobody manages themselves", async () => {
    await expect(
      updateMember(appDb, ctx(), ["admin"], {
        userId: admin.id,
        roles: ["seller"],
        managerUserId: null,
      }),
    ).rejects.toThrow(/own admin/);
    await expect(
      updateMember(appDb, ctx(), ["admin"], {
        userId: admin.id,
        roles: ["admin"],
        managerUserId: admin.id,
      }),
    ).rejects.toThrow(/themselves/);
  });
  it("an admin sets another member's roles and manager", async () => {
    const { members } = await listMembers(appDb, ctx(), ["admin"]);
    const other = members.find((m) => m.userId !== admin.id)!;
    await updateMember(appDb, ctx(), ["admin"], {
      userId: other.userId,
      roles: ["seller"],
      managerUserId: admin.id,
    });
    const after = (await listMembers(appDb, ctx(), ["admin"])).members.find(
      (m) => m.userId === other.userId,
    )!;
    expect(after).toMatchObject({ roles: ["seller"], managerUserId: admin.id });
  });
});
