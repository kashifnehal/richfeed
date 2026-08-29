import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

const STORAGE_STATE = resolve(__dirname, "e2e/.auth/user.json");

// Test credentials live in a git-ignored .env.test (same never-hardcode
// pattern as every other secret in this repo). See apps/web/.env.test.
loadEnv({ path: resolve(__dirname, ".env.test") });
// .env.local gives the tests NEXT_PUBLIC_API_URL for their direct API round-trips.
loadEnv({ path: resolve(__dirname, ".env.local") });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

if (!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD || !process.env.E2E_USER_ID) {
  throw new Error(
    "E2E_USER_ID / E2E_USER_EMAIL / E2E_USER_PASSWORD missing — create apps/web/.env.test (see .env.test.example).",
  );
}

export default defineConfig({
  testDir: "./e2e",
  // Re-seeds the shared demo dataset from scratch before the suite runs.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // One retry everywhere: dev-mode Next.js under load occasionally drops a
  // first navigation / cold compile. A genuinely broken assertion still fails
  // twice.
  retries: 1,
  reporter: [["list"]],
  // Generous: dev-mode Next.js route compilation can take 20-40s on a cold hit.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // The whole suite depends on this one sign-in; give it extra retries.
    { name: "setup", testMatch: /auth\.setup\.ts/, retries: 3 },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
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
