import { afterAll, describe, expect, it } from "vitest";
import { closePools, ownerPool } from "./support/db";
import { OWNED_TABLES, TENANT_TABLES } from "./support/fixtures";

afterAll(closePools);

/** Regression guards: a new table that forgets RLS, owner policies or the audit trigger fails here. */
describe("database catalogue", () => {
  it("the app role cannot bypass RLS and owns no tables", async () => {
    const { rows } = await ownerPool.query(
      `SELECT rolsuper, rolbypassrls, (SELECT count(*)::int FROM pg_tables WHERE tableowner = 'clean_app') AS owned
         FROM pg_roles WHERE rolname = 'clean_app'`,
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, owned: 0 });
  });

  it("every table with organization_id is a registered tenant table", async () => {
    const { rows } = await ownerPool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'organization_id' AND table_name <> 'audit_event'
        ORDER BY table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([...TENANT_TABLES].sort());
  });

  it("every table with owner_id is a registered seller-owned table", async () => {
    const { rows } = await ownerPool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'owner_id' ORDER BY table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([...OWNED_TABLES].sort());
  });

  it.each(TENANT_TABLES)(
    "%s has forced RLS, the tenant policy and both triggers",
    async (t) => {
      const { rows } = await ownerPool.query(
        `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
              EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname = 'tenant_isolation') AS policy,
              EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = c.oid AND g.tgname = 'audit') AS audit,
              EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = c.oid AND g.tgname = 'set_updated_at') AS updated_at
         FROM pg_class c WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
        [t],
      );
      expect(rows[0]).toEqual({
        rls: true,
        forced: true,
        policy: true,
        audit: true,
        updated_at: true,
      });
    },
  );

  it.each(OWNED_TABLES)(
    "%s has the four restrictive owner policies",
    async (t) => {
      const { rows } = await ownerPool.query<{
        policyname: string;
        permissive: string;
        cmd: string;
      }>(
        `SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = $1 AND policyname LIKE 'owner_%' ORDER BY policyname`,
        [t],
      );
      expect(rows).toEqual([
        {
          policyname: "owner_delete",
          permissive: "RESTRICTIVE",
          cmd: "DELETE",
        },
        {
          policyname: "owner_insert",
          permissive: "RESTRICTIVE",
          cmd: "INSERT",
        },
        { policyname: "owner_read", permissive: "RESTRICTIVE", cmd: "SELECT" },
        {
          policyname: "owner_update",
          permissive: "RESTRICTIVE",
          cmd: "UPDATE",
        },
      ]);
    },
  );

  it("the app role can only read audit_event", async () => {
    const { rows } = await ownerPool.query(
      `SELECT has_table_privilege('clean_app', 'audit_event', 'SELECT') AS sel,
              has_table_privilege('clean_app', 'audit_event', 'INSERT') AS ins,
              has_table_privilege('clean_app', 'audit_event', 'UPDATE') AS upd,
              has_table_privilege('clean_app', 'audit_event', 'DELETE') AS del`,
    );
    expect(rows[0]).toEqual({ sel: true, ins: false, upd: false, del: false });
  });

  it("the app role can write but never read the AI provider key", async () => {
    const { rows } = await ownerPool.query(
      `SELECT has_column_privilege('clean_app', 'ai_provider_setting', 'encrypted_key', 'SELECT') AS read_key,
              has_column_privilege('clean_app', 'ai_provider_setting', 'encrypted_key', 'UPDATE') AS write_key,
              has_column_privilege('clean_app', 'ai_provider_setting', 'provider', 'SELECT') AS read_provider`,
    );
    expect(rows[0]).toEqual({
      read_key: false,
      write_key: true,
      read_provider: true,
    });
  });
});
