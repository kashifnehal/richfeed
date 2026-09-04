/**
 * Publish a real test post to an already-connected social account, right now,
 * and poll until the worker takes it to published / failed. Unlike
 * verify-pipeline.ts (which fakes the account + token and never hits a real
 * platform API), this uses a real social_accounts row and its real tokens, so
 * it actually posts to the live platform.
 *
 * Requires the worker process to be running (root `pnpm dev`, or
 * `pnpm --filter api run worker`).
 *
 * Run with:
 *   tsx --env-file-if-exists=.env src/scripts/publish-test-post.ts --account=<social_account_id> [--text="..."]
 *
 * It does NOT clean up: a real published post can't be un-published, and the
 * scheduled_post row is worth keeping as evidence. Jitter is disabled so the
 * job runs immediately.
 */

import { createScheduledPost, addPostTarget, getPostTarget } from "../db/queries";
import { getSupabaseClient } from "../db/supabase";
import { getRedisConnection } from "../queue/connection";
import { enqueuePublishJob, getPublishQueue } from "../queue/scheduler";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

async function main() {
  const accountId = argValue("account");
  if (!accountId) throw new Error("pass --account=<social_account_id>");
  const text =
    argValue("text") ?? `RichFeed end-to-end publish check ${new Date().toISOString()}`;

  const supabase = getSupabaseClient();
  const { data: account, error } = await supabase
    .from("social_accounts")
    .select("id, user_id, platform, display_name, status")
    .eq("id", accountId)
    .single();
  if (error || !account) throw new Error(`account ${accountId} not found: ${error?.message}`);

  console.log(
    `[publish-test] account ${account.id} platform=${account.platform} name=${JSON.stringify(account.display_name)} status=${account.status}`,
  );

  const post = await createScheduledPost(account.user_id as string, {
    caption: text,
    hashtags: [],
    mediaUrls: [],
    mediaType: null,
  });
  console.log(`[publish-test] scheduled_post ${post.id}  caption=${JSON.stringify(text)}`);

  const publishAt = new Date(Date.now() + 2000);
  const target = await addPostTarget(post.id, accountId, publishAt);
  console.log(`[publish-test] post_target ${target.id} status=${target.status}`);

  await enqueuePublishJob(target.id, publishAt, { disableJitter: true });
  console.log(`[publish-test] enqueued; polling up to ${POLL_TIMEOUT_MS / 1000}s...`);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let last = target.status;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const cur = await getPostTarget(target.id);
    if (!cur) throw new Error("post_target disappeared");
    if (cur.status !== last) {
      last = cur.status;
      console.log(`[publish-test] status -> ${cur.status}`);
    }
    if (cur.status === "published" || cur.status === "failed") {
      console.log(
        `[publish-test] final: status=${cur.status} platform_post_id=${cur.platform_post_id ?? "-"} permalink=${cur.permalink_url ?? "-"}`,
      );
      const { data: attempts } = await supabase
        .from("publish_attempts")
        .select("attempt_number, http_status, error_code, error_message")
        .eq("post_target_id", target.id);
      console.log(`[publish-test] attempts: ${JSON.stringify(attempts)}`);
      await shutdown();
      process.exit(cur.status === "published" ? 0 : 1);
    }
  }

  console.log(`[publish-test] TIMEOUT — last status ${last}. Is the worker running?`);
  await shutdown();
  process.exit(1);
}

async function shutdown() {
  try {
    await getPublishQueue().close();
  } catch {
    /* best-effort */
  }
  try {
    getRedisConnection().disconnect();
  } catch {
    /* best-effort */
  }
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await shutdown();
  process.exit(1);
});
