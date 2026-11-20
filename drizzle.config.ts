import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migrations run as the table OWNER, never as the runtime app role.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_OWNER ??
      "postgres://clean_owner:clean_owner@localhost:5432/clean",
  },
  strict: true,
  verbose: true,
});
