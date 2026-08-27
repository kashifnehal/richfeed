import type { Config } from "tailwindcss";
import preset from "@richfeed/ui/tailwind.preset";

/**
 * apps/web intentionally defines NO color values of its own — every color comes
 * from the shared @richfeed/ui preset, which maps to the CSS tokens.
 */
const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/index.ts",
    "../../packages/ui/components/**/*.{ts,tsx}",
  ],
};

export default config;
