import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { startMailSink } from "./mail-sink";

/** Reset the e2e database from migrations and start the local mail sink. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL_OWNER;
  if (!url || !/clean_e2e/.test(url))
    throw new Error(
      "E2E_DATABASE_URL_OWNER must point at the clean_e2e database",
    );
  const pool = new Pool({ connectionString: url });
  await pool.query(
    "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
  );
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  await pool.end();
  const stop = await startMailSink();
  return async () => stop();
}
