import base from "@richfeed/config/eslint.config.mjs";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  ...base,
  {
    name: "next",
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // App Router has no pages/_document; the Google Fonts <link> in the root
      // layout is the intended pattern for this project.
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
