import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { appDb, closePools } from "./support/db";
import {
  as,
  createTenantFixture,
  OWNED_TABLES,
  type TenantFixture,
} from "./support/fixtures";
import { PG, pgErrorCode } from "./support/pg-error";

/**
 * Rule 2: inside a tenant, a seller's records are private. Others can read them
 * only when the admin enables team visibility, and then only teammates and the
 * management chain — never the admin by default. Writes are owner-only.
 */
let F: TenantFixture;
type Who = "sellerId" | "peerId" | "managerId" | "adminId";

beforeAll(async () => {
  F = await createTenantFixture("privacy");
});
afterAll(closePools);

async function visible(who: Who, table: string): Promise<number> {
  return withTenant(appDb, as(F, who), async (tx) => {
    const r = await tx.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} WHERE id = ${F.ids[table as keyof typeof F.ids]}`,
    );
    return r.rows[0]!.n;
  });
}
async function affected(
  who: Who,
  statement: (table: string, id: string) => ReturnType<typeof sql>,
  table: string,
): Promise<number | null> {
  return withTenant(
    appDb,
    as(F, who),
    async (tx) =>
      (await tx.execute(statement(table, F.ids[table as keyof typeof F.ids])))
        .rowCount,
  );
}
const touch = (table: string, id: string) =>
  sql`UPDATE ${sql.identifier(table)} SET updated_at = now() WHERE id = ${id}`;
const remove = (table: string, id: string) =>
  sql`DELETE FROM ${sql.identifier(table)} WHERE id = ${id}`;
async function setTeamVisibility(on: boolean) {
  await withTenant(appDb, as(F, "adminId"), (tx) =>
    tx
      .update(s.organization)
      .set({ teamVisibility: on })
      .where(eq(s.organization.id, F.organizationId)),
  );
}

describe("team visibility OFF (default)", () => {
  describe.each(OWNED_TABLES)("%s", (table) => {
    it("the owner sees the row", async () =>
      expect(await visible("sellerId", table)).toBe(1));
    it("a teammate cannot see it", async () =>
      expect(await visible("peerId", table)).toBe(0));
    it("the manager cannot see it", async () =>
      expect(await visible("managerId", table)).toBe(0));
    it("the admin cannot see it", async () =>
      expect(await visible("adminId", table)).toBe(0));
    it("a teammate cannot update or delete it", async () => {
      expect(await affected("peerId", touch, table)).toBe(0);
      expect(await affected("peerId", remove, table)).toBe(0);
      expect(await visible("sellerId", table)).toBe(1);
    });
  });

  it("only the recipient sees a notification", async () => {
    expect(await visible("sellerId", "notification")).toBe(1);
    expect(await visible("peerId", "notification")).toBe(0);
    expect(await visible("adminId", "notification")).toBe(0);
  });
});

describe("team visibility ON", () => {
  beforeAll(() => setTeamVisibility(true));
  afterAll(() => setTeamVisibility(false));

  describe.each(OWNED_TABLES)("%s", (table) => {
    it("a teammate (same manager) can read it", async () =>
      expect(await visible("peerId", table)).toBe(1));
    it("the manager can read it", async () =>
      expect(await visible("managerId", table)).toBe(1));
    it("the admin, outside the team, still cannot", async () =>
      expect(await visible("adminId", table)).toBe(0));
    it("the manager still cannot change or delete it", async () => {
      expect(await affected("managerId", touch, table)).toBe(0);
      expect(await affected("managerId", remove, table)).toBe(0);
    });
  });
});

describe("writes and references", () => {
  it("no one can create a record in someone else's name", async () => {
    const code = await pgErrorCode(
      withTenant(appDb, as(F, "peerId"), (tx) =>
        tx.insert(s.account).values({ name: "Not mine", ownerId: F.sellerId }),
      ),
    );
    expect(code).toBe(PG.insufficientPrivilege);
  });

  it("the owner cannot hand a record to someone else (no transfers in Phase 1)", async () => {
    const code = await pgErrorCode(
      withTenant(appDb, as(F), (tx) =>
        tx
          .update(s.account)
          .set({ ownerId: F.peerId })
          .where(eq(s.account.id, F.ids.account)),
      ),
    );
    expect(code).toBe(PG.insufficientPrivilege);
  });

  it("a seller cannot attach a deal to another seller's account (owner-safe FK)", async () => {
    await setTeamVisibility(true); // even when they can see it
    try {
      const code = await pgErrorCode(
        withTenant(appDb, as(F, "peerId"), (tx) =>
          tx.insert(s.deal).values({
            accountId: F.ids.account,
            name: "Piggyback",
            stageId: F.ids.pipeline_stage,
          }),
        ),
      );
      expect(code).toBe(PG.foreignKeyViolation);
    } finally {
      await setTeamVisibility(false);
    }
  });

  it("the app cannot read the AI provider key back", async () => {
    const code = await pgErrorCode(
      withTenant(appDb, as(F), (tx) =>
        tx.execute(sql`SELECT encrypted_key FROM ai_provider_setting`),
      ),
    );
    expect(code).toBe(PG.insufficientPrivilege);
  });
});
