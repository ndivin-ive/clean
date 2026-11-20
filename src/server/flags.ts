import { eq } from "drizzle-orm";
import { FLAGS, resolveFlag, type FlagKey } from "@/domain/flags";
import { featureFlag } from "./db/schema";
import type { Tx } from "./db/tenant";

/** Read a flag for the current tenant (call inside withTenant). Falls back to the default in src/domain/flags.ts. */
export async function isEnabled(tx: Tx, key: FlagKey): Promise<boolean> {
  const rows = await tx
    .select({ key: featureFlag.key, enabled: featureFlag.enabled })
    .from(featureFlag)
    .where(eq(featureFlag.key, key));
  return resolveFlag(key, new Map(rows.map((r) => [r.key, r.enabled])));
}

export const knownFlags = Object.keys(FLAGS) as FlagKey[];
