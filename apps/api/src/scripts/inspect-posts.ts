/**
 * Read-only inspection of recent scheduled_posts / post_targets and their
 * publish_attempts. Handy for "did my test post actually publish, and if not,
 * why" without hand-writing a Supabase query each time.
 *
 * Run with:
 *   tsx --env-file-if-exists=.env src/scripts/inspect-posts.ts [--platform=twitter] [--limit=10]
 *
 * Uses the service-role client, so it bypasses RLS and sees every user's rows.
 * Purely a read — it never mutates anything.
 */

import { getSupabaseClient } from "../db/supabase";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const supabase = getSupabaseClient();
  const platform = argValue("platform");
  const limit = Number(argValue("limit") ?? 10);

  const { data: posts, error } = await supabase
    .from("scheduled_posts")
    .select("id, user_id, caption, media_type, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`scheduled_posts query failed: ${error.message}`);
  if (!posts?.length) {
    console.log("no scheduled_posts found");
    return;
  }

  for (const post of posts) {
    const { data: targets, error: targetError } = await supabase
      .from("post_targets")
      .select(
        "id, status, publish_at, platform_post_id, permalink_url, created_at, updated_at, social_accounts(platform, display_name, status)",
      )
      .eq("scheduled_post_id", post.id)
      .order("publish_at", { ascending: true });

    if (targetError) {
      throw new Error(`post_targets query failed: ${targetError.message}`);
    }

    const rows = (targets ?? []).filter((t) => {
      if (!platform) return true;
      const acct = t.social_accounts as { platform?: string } | null;
      return acct?.platform === platform;
    });

    if (platform && rows.length === 0) continue;

    console.log(
      `\nscheduled_post ${post.id}  created=${post.created_at}\n  caption: ${JSON.stringify(post.caption)}`,
    );

    for (const t of rows) {
      const acct = t.social_accounts as
        | { platform?: string; display_name?: string; status?: string }
        | null;
      console.log(
        `  target ${t.id}\n` +
          `    platform=${acct?.platform} account=${JSON.stringify(acct?.display_name)} account_status=${acct?.status}\n` +
          `    status=${t.status}  publish_at=${t.publish_at}  updated_at=${t.updated_at}\n` +
          `    platform_post_id=${t.platform_post_id ?? "-"}  permalink=${t.permalink_url ?? "-"}`,
      );

      const { data: attempts } = await supabase
        .from("publish_attempts")
        .select("attempt_number, attempted_at, http_status, error_code, error_message")
        .eq("post_target_id", t.id)
        .order("attempted_at", { ascending: true });

      for (const a of attempts ?? []) {
        console.log(
          `    attempt #${a.attempt_number} @ ${a.attempted_at}  http=${a.http_status ?? "-"}  ` +
            `${a.error_code ?? "ok"}  ${a.error_message ?? ""}`,
        );
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
