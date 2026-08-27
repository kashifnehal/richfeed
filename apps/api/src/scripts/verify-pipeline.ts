/**
 * Live end-to-end verification of the scheduling engine pipeline:
 *   insert social_account -> scheduled_post -> post_target
 *   -> enqueue publish job -> worker picks it up
 *   -> observe pending -> publishing -> published transitions
 *
 * Run with:
 *   tsx --env-file-if-exists=.env src/scripts/verify-pipeline.ts
 *
 * Requires a running worker process (`pnpm --filter api worker`) against the
 * same Redis/Supabase — this script only enqueues and observes, it does not
 * process jobs itself.
 *
 * FK note: social_accounts.user_id and scheduled_posts.user_id reference
 * auth.users(id). We create a real throwaway Supabase Auth user via the
 * service-role admin API for the duration of the test and delete it (along
 * with every row it owns) in cleanup, whether the test passes or fails.
 *
 * Jitter note: enqueuePublishJob() normally adds a 2-5 minute random jitter
 * on top of publishAt (real production behavior, per doc 35 §3.3). That
 * would make this script's ~30s polling window useless, so this script
 * passes { disableJitter: true } explicitly — a test-only escape hatch
 * documented in queue/scheduler.ts. Production callers never set this.
 */

import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../db/supabase";
import {
  createScheduledPost,
  getPostTarget,
  addPostTarget,
} from "../db/queries";
import { encrypt } from "../lib/crypto";
import { enqueuePublishJob, getPublishQueue } from "../queue/scheduler";
import { getRedisConnection } from "../queue/connection";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;

interface Cleanup {
  scheduledPostId?: string;
  socialAccountId?: string;
  authUserId?: string;
}

async function main() {
  const supabase = getSupabaseClient();
  const cleanup: Cleanup = {};
  let exitCode = 0;

  try {
    // 1. Real throwaway auth user, to satisfy the FK on user_id columns.
    const testEmail = `verify-pipeline-${randomUUID()}@example.invalid`;
    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: testEmail,
        password: randomUUID(),
        email_confirm: true,
      });

    if (userError || !userData.user) {
      throw new Error(`Failed to create throwaway auth user: ${userError?.message}`);
    }

    cleanup.authUserId = userData.user.id;
    const userId = userData.user.id;
    console.log(`[verify] created throwaway auth user ${userId}`);

    // 2. social_accounts row with a fake encrypted access token.
    const fakeAccessToken = encrypt(`fake-access-token-${randomUUID()}`);

    const { data: accountData, error: accountError } = await supabase
      .from("social_accounts")
      .insert({
        user_id: userId,
        platform: "instagram",
        platform_account_id: `verify-pipeline-${randomUUID()}`,
        display_name: "Verify Pipeline Test Account",
        access_token: fakeAccessToken,
        status: "connected",
      })
      .select()
      .single();

    if (accountError || !accountData) {
      throw new Error(`Failed to insert social_account: ${accountError?.message}`);
    }

    cleanup.socialAccountId = accountData.id as string;
    console.log(`[verify] created social_account ${accountData.id}`);

    // 3. scheduled_post.
    const scheduledPost = await createScheduledPost(userId, {
      caption: "Verify pipeline test post",
      hashtags: ["#test"],
      mediaUrls: [],
      mediaType: "image",
    });
    cleanup.scheduledPostId = scheduledPost.id;
    console.log(`[verify] created scheduled_post ${scheduledPost.id}`);

    // 4. post_target, publish_at = now + 5s.
    const publishAt = new Date(Date.now() + 5000);
    const postTarget = await addPostTarget(
      scheduledPost.id,
      accountData.id as string,
      publishAt,
    );
    console.log(
      `[verify] created post_target ${postTarget.id} (publish_at=${publishAt.toISOString()}, status=${postTarget.status})`,
    );

    // 5. Enqueue, with jitter disabled for this test run (see file header).
    await enqueuePublishJob(postTarget.id, publishAt, { disableJitter: true });
    console.log(`[verify] enqueued publish job for post_target ${postTarget.id}`);

    // 6. Poll for status transitions.
    console.log(
      `[verify] polling every ${POLL_INTERVAL_MS}ms for up to ${POLL_TIMEOUT_MS}ms...`,
    );

    const seen: string[] = [postTarget.status];
    console.log(`[verify] status: ${postTarget.status}`);

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let finalStatus = postTarget.status;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const current = await getPostTarget(postTarget.id);
      if (!current) {
        throw new Error(`post_target ${postTarget.id} disappeared mid-poll`);
      }

      if (current.status !== seen.at(-1)) {
        seen.push(current.status);
        console.log(`[verify] status: ${current.status}`);
      }

      finalStatus = current.status;

      if (finalStatus === "published" || finalStatus === "failed") {
        break;
      }
    }

    console.log(`[verify] observed transitions: ${seen.join(" -> ")}`);

    if (finalStatus !== "published") {
      throw new Error(
        `Timed out waiting for post_target to reach "published" (last status: "${finalStatus}"). ` +
          `Is a worker running? (pnpm --filter api worker)`,
      );
    }

    console.log("[verify] SUCCESS: observed pending -> publishing -> published");
  } catch (err) {
    exitCode = 1;
    console.error("[verify] FAILURE:", err instanceof Error ? err.message : err);
  } finally {
    await cleanupTestRows(supabase, cleanup);

    // Close our own producer-side queue connection so the process can exit.
    try {
      await getPublishQueue().close();
    } catch {
      // best-effort
    }
    try {
      getRedisConnection().disconnect();
    } catch {
      // best-effort
    }
  }

  process.exit(exitCode);
}

async function cleanupTestRows(
  supabase: ReturnType<typeof getSupabaseClient>,
  cleanup: Cleanup,
) {
  console.log("[verify] cleaning up test rows...");

  // scheduled_posts delete cascades to post_targets, which cascades to
  // publish_attempts.
  if (cleanup.scheduledPostId) {
    const { error } = await supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", cleanup.scheduledPostId);
    if (error) {
      console.error(`[verify] cleanup: failed to delete scheduled_post: ${error.message}`);
    }
  }

  if (cleanup.socialAccountId) {
    const { error } = await supabase
      .from("social_accounts")
      .delete()
      .eq("id", cleanup.socialAccountId);
    if (error) {
      console.error(`[verify] cleanup: failed to delete social_account: ${error.message}`);
    }
  }

  if (cleanup.authUserId) {
    const { error } = await supabase.auth.admin.deleteUser(cleanup.authUserId);
    if (error) {
      console.error(`[verify] cleanup: failed to delete auth user: ${error.message}`);
    }
  }

  console.log("[verify] cleanup complete");
}

main();
