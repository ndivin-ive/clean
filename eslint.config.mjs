import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Provider SDKs may only be imported by the AI gateway (rule 5).
const AI_PROVIDER_SDKS = [
  "@anthropic-ai/*",
  "openai",
  "openai/*",
  "@mistralai/*",
  "@azure/openai",
  "@aws-sdk/client-bedrock*",
  "@google-cloud/vertexai",
  "@google/genai",
  "ai",
  "@ai-sdk/*",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: AI_PROVIDER_SDKS,
              message:
                "AI provider SDKs may only be imported in src/server/ai/ (rule 5: model-agnostic AI gateway).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/ai/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Rule 3: no hard-coded user-facing text in UI code. Use next-intl.
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ["·", "—", "/", "%"],
        },
      ],
    },
  },
  {
    // Domain code is pure: no framework, DB or server imports.
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react-dom",
                "@/server/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "pg",
              ],
              message:
                "src/domain must stay pure (no framework, DB or server imports).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
