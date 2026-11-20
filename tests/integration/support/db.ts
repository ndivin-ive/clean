import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/server/db/schema";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Connects as clean_app — RLS applies. This is what the web app uses. */
export const appPool = new Pool({
  connectionString: required("TEST_DATABASE_URL"),
  max: 5,
});
export const appDb = drizzle(appPool, { schema });

/** Connects as the table owner — for assertions on the catalogue only. */
export const ownerPool = new Pool({
  connectionString: required("TEST_DATABASE_URL_OWNER"),
  max: 2,
});

export async function closePools(): Promise<void> {
  await Promise.all([appPool.end(), ownerPool.end()]);
}
