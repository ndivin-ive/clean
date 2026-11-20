import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl picks up src/i18n/request.ts automatically.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Deliberately OFF: almost every CLEAN screen renders per-user, per-tenant
  // data. Opt-in caching (`use cache`) risks serving one tenant's data to
  // another. See docs/DECISIONS.md (D-004).
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
