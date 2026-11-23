/**
 * Demo seed: `pnpm db:seed` (dev database) or `pnpm db:seed --test`.
 * Seeds two demo organisations (invented data only):
 *   - Lumen Data (generic SaaS profile, English): camille.martin@lumendata.example
 *   - Meca-Inox (démo) (industrial_equipment profile, French), the use case in
 *     docs/USE_CASE_MECA_INOX.md: julien.morel@meca-inox.example
 * For each, removes the previous copy (fixed organisation id and demo email
 * domain), then seeds through the app role so RLS and auditing apply.
 * Sign in locally with a magic link (Mailpit).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { LUMEN_DEMO, type DemoDataset } from "../src/server/seed/demo-data";
import { MECA_INOX_DEMO } from "../src/server/seed/meca-inox-data";
import { seedDemo } from "../src/server/seed/demo";

const test = process.argv.includes("--test");
const appUrl = test ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
const ownerUrl = test
  ? process.env.TEST_DATABASE_URL_OWNER
  : process.env.DATABASE_URL_OWNER;
if (!appUrl || !ownerUrl)
  throw new Error("Database URLs are not set (see .env.example)");

const datasets: DemoDataset[] = [LUMEN_DEMO, MECA_INOX_DEMO];

const owner = new Pool({ connectionString: ownerUrl });
for (const d of datasets) {
  await owner.query("DELETE FROM organization WHERE id = $1", [d.org.id]);
  await owner.query("DELETE FROM audit_event WHERE organization_id = $1", [
    d.org.id,
  ]);
  await owner.query("DELETE FROM auth_user WHERE email LIKE $1", [
    `%@${d.domain}`,
  ]);
}
await owner.end();

const pool = new Pool({ connectionString: appUrl });
const db = drizzle(pool, { schema });
for (const d of datasets) {
  const ids = await seedDemo(db, d);
  console.log(
    `Demo organisation "${d.org.name}" seeded: ${Object.keys(ids.accounts).length} accounts, ${Object.keys(ids.deals).length} deals, ${Object.keys(ids.people).length} people.`,
  );
  console.log(
    `  Sign in as ${d.users.seller.email} (seller), ${d.users.manager.email} (manager) or ${d.users.admin.email} (admin).`,
  );
}
await pool.end();
