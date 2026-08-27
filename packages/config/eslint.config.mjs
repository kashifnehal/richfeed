import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for the richfeed monorepo.
 * Consumed by apps/web, apps/api and packages/ui via `extends` (re-export).
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);
