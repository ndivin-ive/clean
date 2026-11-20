/**
 * Apply Drizzle migrations as the table owner.
 * Usage: pnpm db:migrate            (uses DATABASE_URL_OWNER)
 *        pnpm db:migrate --test     (uses TEST_DATABASE_URL_OWNER)
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { existsSync } from "node:fs";
import { Pool } from "pg";

const useTest = process.argv.includes("--test");
const url = useTest
  ? process.env.TEST_DATABASE_URL_OWNER
  : process.env.DATABASE_URL_OWNER;

if (!url) {
  console.error(
    `${useTest ? "TEST_DATABASE_URL_OWNER" : "DATABASE_URL_OWNER"} is not set`,
  );
  process.exit(1);
}

if (!existsSync("drizzle/meta/_journal.json")) {
  console.log("No migrations yet — nothing to apply.");
  process.exit(0);
}

const pool = new Pool({ connectionString: url });
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
await pool.end();
console.log(`Migrations applied to ${useTest ? "test" : "dev"} database.`);
