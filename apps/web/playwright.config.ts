import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Test credentials live in a git-ignored .env.test (same never-hardcode
// pattern as every other secret in this repo). See apps/web/.env.test.
loadEnv({ path: resolve(__dirname, ".env.test") });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

if (!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD) {
  throw new Error(
    "E2E_USER_EMAIL / E2E_USER_PASSWORD missing — create apps/web/.env.test (see repo notes).",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Boots the whole local stack (web + api + worker) if it isn't already up.
  webServer: {
    command: "sh -c 'cd ../.. && pnpm dev'",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
