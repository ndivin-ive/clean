import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Rebuild the test database from migrations before the integration run. */
export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL_OWNER;
  if (!url) throw new Error("TEST_DATABASE_URL_OWNER is not set");
  if (!/clean_test/.test(url)) {
    throw new Error(
      "Refusing to reset a database whose name is not clean_test",
    );
  }
  const pool = new Pool({ connectionString: url });
  await pool.query(`
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
  `);
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  await pool.end();
}
