/**
 * Ensures one real, confirmed Supabase Auth user exists for local demo /
 * click-through / E2E use with seed-demo-data.ts. Same admin-API pattern as
 * verify-pipeline.ts.
 *
 * Run with:
 *   pnpm --filter api create-demo-user
 *   pnpm --filter api create-demo-user -- --email demo@example.com --password 'hunter2'
 *   pnpm --filter api create-demo-user -- --user <existing-auth-user-uuid> --password 'hunter2'
 *
 * Idempotent: if a user with the given email (or --user id) already exists,
 * its password is reset to the given/generated value rather than erroring or
 * creating a duplicate. Prints the resulting email / id / password.
 *
 * Then seed demo data for it:
 *   pnpm --filter api seed -- --user <id>
 */

import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../db/supabase";

function parseArgs(argv: string[]) {
  const out: { email?: string; password?: string; user?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a?.startsWith("--email=")) out.email = a.slice(8);
    else if (a === "--password") out.password = argv[++i];
    else if (a?.startsWith("--password=")) out.password = a.slice(11);
    else if (a === "--user") out.user = argv[++i];
    else if (a?.startsWith("--user=")) out.user = a.slice(7);
  }
  return out;
}

async function main() {
  const supabase = getSupabaseClient();
  const args = parseArgs(process.argv.slice(2));

  const email = args.email ?? `demo-${randomUUID().slice(0, 8)}@richfeed.invalid`;
  const password = args.password ?? randomUUID();
  const meta = { full_name: "Demo Founder", workspace_name: "RichFeed Demo" };

  // Resolve an existing user, by --user id or by email.
  let existingId: string | undefined = args.user;
  if (!existingId) {
    // listUsers has no server-side email filter in this SDK version; scan pages.
    for (let page = 1; page <= 20 && !existingId; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        console.error("[create-demo-user] listUsers FAILURE:", error.message);
        process.exit(1);
      }
      existingId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
      if (data.users.length < 200) break;
    }
  }

  if (existingId) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error || !data.user) {
      console.error("[create-demo-user] updateUserById FAILURE:", error?.message);
      process.exit(1);
    }
    console.log("\n[create-demo-user] Reset password for existing Supabase Auth user:");
    console.log(`  email:    ${data.user.email}`);
    console.log(`  password: ${password}`);
    console.log(`  user id:  ${data.user.id}`);
    console.log("\nSeed demo data for this user:");
    console.log(`  pnpm --filter api seed -- --user ${data.user.id}\n`);
    process.exit(0);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });

  if (error || !data.user) {
    console.error("[create-demo-user] FAILURE:", error?.message);
    process.exit(1);
  }

  console.log("\n[create-demo-user] Created a real, confirmed Supabase Auth user:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  user id:  ${data.user.id}`);
  console.log("\nNext step — seed demo data for this user:");
  console.log(`  pnpm --filter api seed -- --user ${data.user.id}\n`);

  process.exit(0);
}

main();
