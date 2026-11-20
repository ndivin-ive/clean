/**
 * Demo seed: `pnpm db:seed` (dev database) or `pnpm db:seed --test`.
 * Removes the previous demo organisation and demo users (invented data only,
 * identified by the fixed demo id and the lumendata.example domain), then seeds
 * the demo book through the app role so RLS and auditing apply.
 * Sign in locally as camille.martin@lumendata.example (magic link in Mailpit).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { DEMO_DOMAIN, DEMO_ORG } from "../src/server/seed/demo-data";
import { seedDemo } from "../src/server/seed/demo";

const test = process.argv.includes("--test");
const appUrl = test ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
const ownerUrl = test
  ? process.env.TEST_DATABASE_URL_OWNER
  : process.env.DATABASE_URL_OWNER;
if (!appUrl || !ownerUrl)
  throw new Error("Database URLs are not set (see .env.example)");

const owner = new Pool({ connectionString: ownerUrl });
await owner.query("DELETE FROM organization WHERE id = $1", [DEMO_ORG.id]);
await owner.query("DELETE FROM audit_event WHERE organization_id = $1", [
  DEMO_ORG.id,
]);
await owner.query("DELETE FROM auth_user WHERE email LIKE $1", [
  `%@${DEMO_DOMAIN}`,
]);
await owner.end();

const pool = new Pool({ connectionString: appUrl });
const ids = await seedDemo(drizzle(pool, { schema }));
await pool.end();
console.log(
  `Demo organisation "${DEMO_ORG.name}" seeded: ${Object.keys(ids.accounts).length} accounts, ${Object.keys(ids.deals).length} deals, ${Object.keys(ids.people).length} people.`,
);
console.log(
  `Sign in as camille.martin@${DEMO_DOMAIN} (seller), sarah.okafor@${DEMO_DOMAIN} (manager) or hugo.bernard@${DEMO_DOMAIN} (admin).`,
);
