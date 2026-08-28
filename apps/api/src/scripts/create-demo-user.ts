/**
 * Creates one throwaway, real, confirmed Supabase Auth user — for local
 * demo/click-through use with seed-demo-data.ts, when no real signed-up
 * account exists yet. Same admin-API pattern as verify-pipeline.ts.
 *
 * Run with:
 *   pnpm --filter api create-demo-user
 *
 * Prints the new user's email/id/password. Re-runnable — each call makes a
 * brand new user rather than reusing one (Supabase Auth users are cheap and
 * this is a dev-only tool). To reset an existing demo user instead of
 * making a new one, just re-run `pnpm --filter api seed -- --user <id>`.
 */

import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../db/supabase";

async function main() {
  const supabase = getSupabaseClient();

  const email = `demo-${randomUUID().slice(0, 8)}@richfeed.invalid`;
  const password = randomUUID();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Demo Founder", workspace_name: "RichFeed Demo" },
  });

  if (error || !data.user) {
    console.error("[create-demo-user] FAILURE:", error?.message);
    process.exit(1);
  }

  console.log("\n[create-demo-user] Created a throwaway Supabase Auth user:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  user id:  ${data.user.id}`);
  console.log("\nNext step — seed demo data for this user:");
  console.log(`  pnpm --filter api seed -- --user ${data.user.id}\n`);

  process.exit(0);
}

main();
