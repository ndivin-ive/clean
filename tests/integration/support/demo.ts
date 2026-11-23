import { seedDemo, type DemoIds } from "@/server/seed/demo";
import { LUMEN_DEMO, type DemoDataset } from "@/server/seed/demo-data";
import { appDb, ownerPool } from "./db";

/** Fresh demo organisation for a test file: clear its previous copy (as `pnpm db:seed` does), then seed. */
export async function demo(
  now: Date,
  data: DemoDataset = LUMEN_DEMO,
): Promise<DemoIds> {
  await ownerPool.query("DELETE FROM organization WHERE id = $1", [
    data.org.id,
  ]);
  await ownerPool.query("DELETE FROM auth_user WHERE email LIKE $1", [
    `%@${data.domain}`,
  ]);
  return seedDemo(appDb, data, now);
}
