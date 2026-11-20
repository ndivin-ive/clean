import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface TenantContext {
  organizationId: string;
  userId: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value))
    throw new Error(`Invalid ${label}: expected a UUID`);
}

/**
 * Run `fn` in a transaction scoped to one tenant. Row-level security policies
 * read `app.org_id`; defaults and the audit trigger read `app.user_id`.
 * `set_config(..., true)` is transaction-local, so the context disappears at
 * COMMIT/ROLLBACK and cannot leak to the next user of a pooled connection.
 *
 * Every tenant data access in the app MUST go through this function.
 */
export async function withTenant<T>(
  db: Db,
  ctx: TenantContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  assertUuid(ctx.organizationId, "organizationId");
  assertUuid(ctx.userId, "userId");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.org_id', ${ctx.organizationId}, true),
                 set_config('app.user_id', ${ctx.userId}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Run `fn` as a signed-in user with NO tenant selected. Only the read-only
 * "my memberships / my organizations" policies match; all other tenant
 * tables return zero rows.
 */
export async function withUser<T>(
  db: Db,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  assertUuid(userId, "userId");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
