/**
 * Deletes one Supabase Auth user by email, if it exists. Idempotent no-op
 * when the user isn't found. Used by the Playwright E2E global-setup to keep
 * the sign-up smoke test's throwaway account from accumulating across runs.
 *
 *   pnpm --filter api exec tsx --env-file-if-exists=.env \
 *     src/scripts/e2e-purge-user.ts --email you+e2e-signup@example.com
 */

import { getSupabaseClient } from "../db/supabase";

function parseEmail(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email") return argv[i + 1] ?? "";
    if (argv[i]?.startsWith("--email=")) return argv[i]!.slice("--email=".length);
  }
  return "";
}

async function main() {
  const email = parseEmail(process.argv.slice(2)).toLowerCase();
  if (!email) {
    console.error("[e2e-purge-user] --email <address> is required");
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[e2e-purge-user] listUsers failed:", error.message);
      process.exit(1);
    }
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    console.log(`[e2e-purge-user] no user for ${email} — nothing to do`);
    process.exit(0);
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`[e2e-purge-user] failed to delete ${email}:`, error.message);
    process.exit(1);
  }
  console.log(`[e2e-purge-user] deleted ${email} (${userId})`);
  process.exit(0);
}

main();
