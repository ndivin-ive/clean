import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/support/global-setup.ts",
  use: {
    baseURL,
    trace: "off",
    // Optional: reuse a pre-installed Chromium (e.g. cloud sandboxes).
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI runs against a production build; locally `next dev` is faster to start.
    command: process.env.CI
      ? `pnpm start --port ${PORT}`
      : `pnpm dev --port ${PORT}`,
    url: `${baseURL}/en`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        "postgres://clean_app:clean_app@localhost:5432/clean_e2e",
      SMTP_URL: `smtp://127.0.0.1:${process.env.E2E_SMTP_PORT ?? 2525}`,
      BETTER_AUTH_URL: baseURL,
      APP_URL: baseURL,
      BETTER_AUTH_SECRET: "e2e-only-secret-not-for-production-0123456789",
      AUTH_RATE_LIMIT: "off",
    },
  },
});
