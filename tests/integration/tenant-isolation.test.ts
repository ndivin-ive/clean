import { count, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@/server/db/schema";
import { withTenant, withUser } from "@/server/db/tenant";
import { appDb, closePools } from "./support/db";
import {
  createTenantFixture,
  TENANT_TABLES,
  type TenantFixture,
} from "./support/fixtures";
import { PG, pgErrorCode } from "./support/pg-error";

let A: TenantFixture;
let B: TenantFixture;

const ctx = (f: TenantFixture) => ({
  organizationId: f.organizationId,
  userId: f.aeUserId,
});

beforeAll(async () => {
  A = await createTenantFixture("alpha");
  B = await createTenantFixture("beta");
});

afterAll(closePools);

async function countById(
  as: TenantFixture,
  table: string,
  id: string,
): Promise<number> {
  return withTenant(appDb, ctx(as), async (tx) => {
    const res = await tx.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} WHERE id = ${id}`,
    );
    return res.rows[0]!.n;
  });
}

describe.each(TENANT_TABLES)("tenant isolation — %s", (table) => {
  it("tenant A sees its own row", async () => {
    expect(await countById(A, table, A.ids[table])).toBe(1);
  });

  it("tenant B cannot SELECT tenant A's row", async () => {
    expect(await countById(B, table, A.ids[table])).toBe(0);
  });

  it("tenant B cannot UPDATE tenant A's row", async () => {
    const affected = await withTenant(appDb, ctx(B), async (tx) => {
      const res = await tx.execute(
        sql`UPDATE ${sql.identifier(table)} SET updated_at = now() WHERE id = ${A.ids[table]}`,
      );
      return res.rowCount;
    });
    expect(affected).toBe(0);
  });

  it("tenant B cannot DELETE tenant A's row", async () => {
    const affected = await withTenant(appDb, ctx(B), async (tx) => {
      const res = await tx.execute(
        sql`DELETE FROM ${sql.identifier(table)} WHERE id = ${A.ids[table]}`,
      );
      return res.rowCount;
    });
    expect(affected).toBe(0);
    expect(await countById(A, table, A.ids[table])).toBe(1);
  });

  it("without tenant context, no rows are visible", async () => {
    const res = await appDb.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)}`,
    );
    expect(res.rows[0]!.n).toBe(0);
  });

  it.skipIf(table === "organization")(
    "tenant B cannot move its own row into tenant A",
    async () => {
      const code = await pgErrorCode(
        withTenant(appDb, ctx(B), (tx) =>
          tx.execute(
            sql`UPDATE ${sql.identifier(table)} SET organization_id = ${A.organizationId}
                WHERE id = ${B.ids[table]}`,
          ),
        ),
      );
      expect(code).toBe(PG.insufficientPrivilege); // RLS WITH CHECK violation
    },
  );
});

describe("tenant isolation — inserts and foreign keys", () => {
  it("cannot INSERT a row labelled with another tenant's organization_id", async () => {
    const code = await pgErrorCode(
      withTenant(appDb, ctx(B), (tx) =>
        tx.insert(s.account).values({
          organizationId: A.organizationId,
          name: "Smuggled",
          ownerId: A.aeUserId,
        }),
      ),
    );
    expect(code).toBe(PG.insufficientPrivilege);
  });

  it("cannot create an organization other than the one in context", async () => {
    const code = await pgErrorCode(
      withTenant(appDb, ctx(B), (tx) =>
        tx
          .insert(s.organization)
          .values({ id: A.organizationId, name: "Hijack" }),
      ),
    );
    // Either the RLS check or the duplicate key rejects it; it must never succeed.
    expect(["42501", "23505"]).toContain(code);
  });

  it("cannot reference another tenant's account (composite FK)", async () => {
    const code = await pgErrorCode(
      withTenant(appDb, ctx(B), (tx) =>
        tx.insert(s.opportunity).values({
          accountId: A.ids.account, // belongs to tenant A
          ownerId: B.aeUserId,
          name: "Cross-tenant",
          stageId: B.ids.pipeline_stage,
        }),
      ),
    );
    expect(code).toBe(PG.foreignKeyViolation);
  });

  it("cannot assign a user who is not a member of the organization", async () => {
    const code = await pgErrorCode(
      withTenant(appDb, ctx(B), (tx) =>
        tx.insert(s.engagementAssignment).values({
          requestId: B.ids.engagement_request,
          userId: A.specialistUserId, // member of A only
        }),
      ),
    );
    expect(code).toBe(PG.foreignKeyViolation);
  });

  it("fills organization_id and created_by from the context", async () => {
    const row = await withTenant(appDb, ctx(A), async (tx) => {
      const [created] = await tx
        .insert(s.account)
        .values({ name: "Defaults Co", ownerId: A.aeUserId })
        .returning();
      return created!;
    });
    expect(row.organizationId).toBe(A.organizationId);
    expect(row.createdBy).toBe(A.aeUserId);
  });
});

describe("signed in without a tenant (organization picker)", () => {
  it("lists only the user's own memberships and organizations", async () => {
    const result = await withUser(appDb, A.aeUserId, async (tx) => ({
      memberships: await tx.select().from(s.membership),
      organizations: await tx.select().from(s.organization),
      accounts: await tx.select({ n: count() }).from(s.account),
    }));
    expect(result.memberships.map((m) => m.userId)).toEqual([A.aeUserId]);
    expect(result.organizations.map((o) => o.id)).toEqual([A.organizationId]);
    expect(result.accounts[0]!.n).toBe(0);
  });

  it("sees a second organization once invited, but still no tenant data", async () => {
    await withTenant(appDb, ctx(B), (tx) =>
      tx
        .insert(s.membership)
        .values({ userId: A.aeUserId, roles: ["specialist"] }),
    );
    const orgs = await withUser(appDb, A.aeUserId, (tx) =>
      tx.select({ id: s.organization.id }).from(s.organization),
    );
    expect(orgs.map((o) => o.id).sort()).toEqual(
      [A.organizationId, B.organizationId].sort(),
    );

    const opportunities = await withUser(appDb, A.aeUserId, (tx) =>
      tx.select({ n: count() }).from(s.opportunity),
    );
    expect(opportunities[0]!.n).toBe(0);
  });

  it("cannot modify memberships without a tenant context", async () => {
    const updated = await withUser(appDb, A.aeUserId, (tx) =>
      tx
        .update(s.membership)
        .set({ roles: ["admin"] })
        .where(eq(s.membership.userId, A.aeUserId))
        .returning(),
    );
    expect(updated).toHaveLength(0);
  });
});

describe("connection pooling", () => {
  it("tenant context does not leak to the next query on the same connection", async () => {
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 1,
    });
    const db = drizzle(pool, { schema: s });
    try {
      await withTenant(db, ctx(A), (tx) => tx.select().from(s.account));
      const res = await db.execute<{ org: string | null }>(
        sql`SELECT app_current_org() AS org`,
      );
      expect(res.rows[0]!.org).toBeNull();
      const accounts = await db.select().from(s.account);
      expect(accounts).toHaveLength(0);
    } finally {
      await pool.end();
    }
  });

  it("rejects a malformed tenant id before touching the database", async () => {
    await expect(
      withTenant(
        appDb,
        { organizationId: "' OR 1=1 --", userId: A.aeUserId },
        async () => 1,
      ),
    ).rejects.toThrow(/Invalid organizationId/);
  });
});
