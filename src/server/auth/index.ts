import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { routing, type AppLocale } from "@/i18n/routing";
import { getDb } from "../db/client";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "../db/schema";
import { magicLinkEmail } from "../mail/templates";
import { sendMail } from "../mail/transport";

/** Locale of the page that asked for the link, read from the callback URL (/fr/...). */
function localeFromUrl(url: string): AppLocale {
  const callback = new URL(url).searchParams.get("callbackURL") ?? "";
  const seg = callback.split("/")[1];
  return (routing.locales as readonly string[]).includes(seg ?? "")
    ? (seg as AppLocale)
    : routing.defaultLocale;
}

function createAuth() {
  const schema = {
    user: authUser,
    session: authSession,
    account: authAccount,
    verification: authVerification,
    auth_user: authUser,
    auth_session: authSession,
    auth_account: authAccount,
    auth_verification: authVerification,
  };
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    user: { modelName: "auth_user" },
    session: { modelName: "auth_session", expiresIn: 60 * 60 * 24 * 14 },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    advanced: { database: { generateId: "uuid" } },
    // On by default; only the end-to-end test server turns it off (many sign-ins from one IP).
    rateLimit: { enabled: process.env.AUTH_RATE_LIMIT !== "off" },
    // Phase 1: magic link only. Google and Microsoft need app registrations first (D-018, Q6).
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          const msg = await magicLinkEmail(localeFromUrl(url), url);
          await sendMail({ to: email, ...msg });
        },
      }),
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
/** Created on first use so builds never need secrets or a database. */
export function getAuth() {
  return (instance ??= createAuth());
}
