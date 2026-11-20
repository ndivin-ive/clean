import { seedDemo, type DemoIds } from "@/server/seed/demo";
import { DEMO_DOMAIN, DEMO_ORG } from "@/server/seed/demo-data";
import { appDb, ownerPool } from "./db";

/** Fresh demo book for a test file: clear previous demo data (as `pnpm db:seed` does), then seed. */
export async function demo(now: Date): Promise<DemoIds> {
  await ownerPool.query("DELETE FROM organization WHERE id = $1", [
    DEMO_ORG.id,
  ]);
  await ownerPool.query("DELETE FROM auth_user WHERE email LIKE $1", [
    `%@${DEMO_DOMAIN}`,
  ]);
  return seedDemo(appDb, now);
}
