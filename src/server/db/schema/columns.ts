import { sql } from "drizzle-orm";
import {
  foreignKey,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Columns every tenant table carries. `organization_id` and `created_by`
 * default to the transaction's tenant context (set by withTenant), and the
 * RLS policy rejects any row whose organization_id differs from it.
 */
export const tenantColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .default(sql`app_current_org()`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid("created_by").default(sql`app_current_user()`),
});

type TenantTable = { organizationId: AnyPgColumn; id: AnyPgColumn };

/** UNIQUE (organization_id, id): target for tenant-safe composite FKs. */
export const tenantKey = (table: TenantTable, name: string) =>
  unique(`${name}_org_id_key`).on(table.organizationId, table.id);

/**
 * Composite FK (organization_id, col) → parent (organization_id, id).
 * PostgreSQL FK checks ignore RLS, so a single-column FK would let a row in
 * tenant B point at a row in tenant A. The composite FK makes that impossible.
 */
export const tenantFk = (
  name: string,
  child: { organizationId: AnyPgColumn },
  column: AnyPgColumn,
  parent: TenantTable,
) =>
  foreignKey({
    name,
    columns: [child.organizationId, column],
    foreignColumns: [parent.organizationId, parent.id],
  });

/**
 * Columns of SELLER-OWNED tables: tenant columns plus `owner_id`, which
 * defaults to the signed-in user. Row-level security restricts reading to the
 * owner (and their team when the admin enables team visibility) and writing to
 * the owner only. See drizzle/0002 and docs/PRIVACY.md.
 */
export const ownedColumns = () => ({
  ...tenantColumns(),
  ownerId: uuid("owner_id")
    .notNull()
    .default(sql`app_current_user()`),
});

type OwnedTable = TenantTable & { ownerId: AnyPgColumn };

/** UNIQUE (organization_id, owner_id, id): target for owner-safe composite FKs. */
export const ownerKey = (table: OwnedTable, name: string) =>
  unique(`${name}_org_owner_id_key`).on(
    table.organizationId,
    table.ownerId,
    table.id,
  );

/**
 * Composite FK (organization_id, owner_id, col) → parent (organization_id, owner_id, id).
 * A child row can only point at a parent in the same tenant AND with the same
 * owner, so privacy can never be bypassed through a reference. ON UPDATE
 * CASCADE lets a future ownership transfer move the whole tree at once.
 */
export const ownedFk = (
  name: string,
  child: { organizationId: AnyPgColumn; ownerId: AnyPgColumn },
  column: AnyPgColumn,
  parent: OwnedTable,
) =>
  foreignKey({
    name,
    columns: [child.organizationId, child.ownerId, column],
    foreignColumns: [parent.organizationId, parent.ownerId, parent.id],
  }).onUpdate("cascade");
