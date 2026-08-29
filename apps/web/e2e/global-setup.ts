import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Runs once before the whole Playwright suite. Resets the shared demo dataset
 * to doc 49's known-clean state so the write-path tests (create post, cancel /
 * duplicate / reschedule a target, disconnect an account) can mutate rows
 * freely without drifting the fixture across runs. Also clears the sign-up
 * smoke test's throwaway account so that test always creates it fresh.
 *
 * Seeding talks straight to Supabase (not through the web/api server), so this
 * is independent of the webServer lifecycle.
 */
export default async function globalSetup(): Promise<void> {
  loadEnv({ path: resolve(__dirname, "../.env.test") });

  const repoRoot = resolve(__dirname, "../../..");
  const userId = process.env.E2E_USER_ID;
  if (!userId) {
    throw new Error("E2E_USER_ID missing — set it in apps/web/.env.test (see .env.test.example).");
  }

  console.log(`\n[e2e global-setup] re-seeding demo data for user ${userId} ...`);
  execFileSync("pnpm", ["--filter", "api", "seed", "--", "--user", userId], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const signupEmail = process.env.E2E_SIGNUP_EMAIL;
  if (signupEmail) {
    console.log(`[e2e global-setup] clearing sign-up test account ${signupEmail} ...`);
    execFileSync(
      "pnpm",
      ["--filter", "api", "e2e:purge-user", "--", "--email", signupEmail],
      { cwd: repoRoot, stdio: "inherit" },
    );
  }

  // Warm up the dev server's route compilation so the first real test isn't
  // racing a 20-40s cold Next.js compile.
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const routes = ["/sign-in", "/dashboard", "/accounts", "/queue", "/calendar", "/posts/new", "/settings"];
  console.log("[e2e global-setup] warming routes ...");
  await Promise.all(
    routes.map((r) =>
      fetch(`${baseUrl}${r}`, { redirect: "manual" }).catch(() => undefined),
    ),
  );

  console.log("[e2e global-setup] done.\n");
}
