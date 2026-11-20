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
