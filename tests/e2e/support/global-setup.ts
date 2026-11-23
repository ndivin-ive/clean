import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../../src/server/db/schema";
import { seedDemo } from "../../../src/server/seed/demo";
import { LUMEN_DEMO } from "../../../src/server/seed/demo-data";
import { MECA_INOX_DEMO } from "../../../src/server/seed/meca-inox-data";
import { startMailSink } from "./mail-sink";

/** Reset the e2e database from migrations, seed both demo books and start the local mail sink. */
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
  // Both demo books, seeded through the app role (RLS applies).
  const app = new Pool({
    connectionString:
      process.env.E2E_DATABASE_URL ??
      url.replace("clean_owner:clean_owner", "clean_app:clean_app"),
  });
  const db = drizzle(app, { schema });
  await seedDemo(db, LUMEN_DEMO);
  await seedDemo(db, MECA_INOX_DEMO);
  await app.end();
  const stop = await startMailSink();
  return async () => stop();
}
