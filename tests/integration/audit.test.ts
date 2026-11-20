import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { appDb, closePools } from "./support/db";
import {
  as,
  createTenantFixture,
  type TenantFixture,
} from "./support/fixtures";
import { PG, pgErrorCode } from "./support/pg-error";

let A: TenantFixture;
let B: TenantFixture;
const ctx = (f: TenantFixture) => as(f);

beforeAll(async () => {
  A = await createTenantFixture("audit-a");
  B = await createTenantFixture("audit-b");
});
afterAll(closePools);

async function eventsFor(tx: Tx, entity: string, entityId: string) {
  return tx
    .select()
    .from(s.auditEvent)
    .where(
      and(eq(s.auditEvent.entity, entity), eq(s.auditEvent.entityId, entityId)),
    )
    .orderBy(desc(s.auditEvent.at), desc(s.auditEvent.action));
}

describe("audit trail (rule 6: every write is recorded)", () => {
  it("records insert, update and delete with actor, before and after", async () => {
    const events = await withTenant(appDb, ctx(A), async (tx) => {
      const [row] = await tx
        .insert(s.account)
        .values({ name: "Audited SA" })
        .returning();
      await tx
        .update(s.account)
        .set({ name: "Audited SAS" })
        .where(eq(s.account.id, row!.id));
      await tx.delete(s.account).where(eq(s.account.id, row!.id));
      return eventsFor(tx, "account", row!.id);
    });

    const byAction = Object.fromEntries(events.map((e) => [e.action, e]));
    expect(Object.keys(byAction).sort()).toEqual([
      "delete",
      "insert",
      "update",
    ]);
    for (const e of events) {
      expect(e.actorId).toBe(A.sellerId);
      expect(e.organizationId).toBe(A.organizationId);
    }
    expect(byAction.insert!.before).toBeNull();
    expect(byAction.insert!.after).toMatchObject({ name: "Audited SA" });
    expect(byAction.update!.before).toMatchObject({ name: "Audited SA" });
    expect(byAction.update!.after).toMatchObject({ name: "Audited SAS" });
    expect(byAction.delete!.after).toBeNull();
  });

  it("does not record a no-op update", async () => {
    const n = await withTenant(appDb, ctx(A), async (tx) => {
      await tx
        .update(s.account)
        .set({ name: sql`${s.account.name}` })
        .where(eq(s.account.id, A.ids.account));
      return (await eventsFor(tx, "account", A.ids.account)).filter(
        (e) => e.action === "update",
      ).length;
    });
    expect(n).toBe(0);
  });

  it("never stores secrets such as invitation token hashes or AI keys", async () => {
    const [inv, ai] = await withTenant(appDb, ctx(A), async (tx) => [
      await eventsFor(tx, "invitation", A.ids.invitation),
      await eventsFor(tx, "ai_provider_setting", A.ids.ai_provider_setting),
    ]);
    expect(inv).toHaveLength(1);
    expect(inv[0]!.after).not.toHaveProperty("token_hash");
    expect(JSON.stringify(inv[0])).not.toContain("hash-");
    expect(ai).toHaveLength(1);
    expect(ai[0]!.after).not.toHaveProperty("encrypted_key");
    expect(JSON.stringify(ai[0])).not.toContain("secret");
  });

  it("tenant B cannot read tenant A's audit events", async () => {
    const rows = await withTenant(appDb, ctx(B), (tx) =>
      tx
        .select()
        .from(s.auditEvent)
        .where(eq(s.auditEvent.organizationId, A.organizationId)),
    );
    expect(rows).toHaveLength(0);
  });

  it("the app cannot insert, update or delete audit events", async () => {
    const attempts = [
      sql`INSERT INTO audit_event (organization_id, entity, action) VALUES (${A.organizationId}, 'x', 'insert')`,
      sql`UPDATE audit_event SET entity = 'tampered'`,
      sql`DELETE FROM audit_event`,
    ];
    for (const statement of attempts) {
      const code = await pgErrorCode(
        withTenant(appDb, ctx(A), (tx) => tx.execute(statement)),
      );
      expect(code).toBe(PG.insufficientPrivilege);
    }
  });
});
