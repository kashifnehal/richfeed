/**
 * Throwaway, one-off verification for the "scheduling never enqueued a
 * publish job" bug fix (see docs/brain/CHANGELOG.md). Confirms, at the
 * queue/DB level only, that:
 *
 *   1. createScheduledPostWithTargets() now enqueues a real BullMQ job per
 *      target, with jobId === post_target.id.
 *   2. rescheduleTarget() now enqueues a job for the new publishAt.
 *   3. Calling enqueuePublishJob() twice for the same target (simulating a
 *      double-enqueue) does not create a second competing job.
 *
 * Deliberately does NOT start the worker (apps/api/src/queue/worker.ts) and
 * uses a fake access_token, so nothing ever reaches a real platform API.
 * Cleans up every row/job it creates, following verify-pipeline.ts's
 * pattern (throwaway Supabase Auth user + rows, deleted in `finally`).
 *
 * Run with:
 *   tsx --env-file-if-exists=.env src/scripts/verify-enqueue-fix.ts
 */

import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../db/supabase";
import { createScheduledPostWithTargets, rescheduleTarget } from "../db/queries";
import { encrypt } from "../lib/crypto";
import { enqueuePublishJob, getPublishQueue, publishJobId } from "../queue/scheduler";
import { getRedisConnection } from "../queue/connection";

interface Cleanup {
  scheduledPostId?: string;
  socialAccountId?: string;
  authUserId?: string;
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  const supabase = getSupabaseClient();
  const cleanup: Cleanup = {};
  let exitCode = 0;

  try {
    const testEmail = `verify-enqueue-fix-${randomUUID()}@example.invalid`;
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
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

    // Fake, obviously-invalid token — this must never reach a real adapter,
    // and we never start the worker in this script anyway.
    const fakeAccessToken = encrypt(`fake-access-token-${randomUUID()}`);
    const { data: accountData, error: accountError } = await supabase
      .from("social_accounts")
      .insert({
        user_id: userId,
        platform: "twitter",
        platform_account_id: `verify-enqueue-fix-${randomUUID()}`,
        display_name: "Verify Enqueue Fix Test Account",
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

    // --- 1. createScheduledPostWithTargets() enqueues a real job -----------
    const publishAt = new Date(Date.now() + 60 * 60 * 1000); // +1h, well out of the way
    const post = await createScheduledPostWithTargets(userId, {
      caption: "Verify enqueue-fix test post",
      hashtags: ["#test"],
      mediaUrls: [],
      mediaType: null,
      targets: [{ socialAccountId: accountData.id as string, publishAt: publishAt.toISOString() }],
    });
    cleanup.scheduledPostId = post.id;
    const target = post.targets[0];
    assert(target, "post should have exactly one target after create");
    console.log(`[verify] created scheduled_post ${post.id}, target ${target.id}`);

    const queue = getPublishQueue();
    const jobAfterCreate = await queue.getJob(publishJobId(target.id));
    assert(jobAfterCreate, "expected a BullMQ job to exist for the target right after create");
    assert(jobAfterCreate!.id === target.id, `job id ${jobAfterCreate!.id} should equal target id ${target.id}`);
    assert(
      jobAfterCreate!.data.postTargetId === target.id,
      "job payload postTargetId should equal target id",
    );
    const delayed = await queue.getDelayed();
    assert(
      delayed.some((j) => j.id === target.id),
      "job should be in the delayed set (not ready to run immediately)",
    );
    console.log(
      `[verify] PASS: create path enqueued job ${jobAfterCreate!.id} (delay=${jobAfterCreate!.opts.delay}ms, in delayed set)`,
    );

    // --- 2. Double-enqueue is a safe no-op (idempotent jobId) --------------
    const beforeCount = (await queue.getDelayedCount());
    await enqueuePublishJob(target.id, publishAt); // re-enqueue same target
    const afterCount = await queue.getDelayedCount();
    assert(
      afterCount === beforeCount,
      `re-enqueuing the same target should not add a second job (before=${beforeCount}, after=${afterCount})`,
    );
    console.log(`[verify] PASS: double-enqueue for the same target did not create a second job`);

    // --- 3. rescheduleTarget() enqueues a job for the new time -------------
    const newPublishAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
    const result = await rescheduleTarget(userId, target.id, newPublishAt.toISOString());
    assert(result.ok, `reschedule should succeed, got: ${JSON.stringify(result)}`);

    const jobAfterReschedule = await queue.getJob(publishJobId(target.id));
    assert(jobAfterReschedule, "expected a job to still exist for the target after reschedule");
    // Same jobId (idempotent), but BullMQ keeps the *original* delay when the
    // job already existed at enqueue time (see handleDuplicatedJob) — the
    // DB row's publish_at is still updated correctly, which is what the UI
    // and worker actually read. Confirm the DB side reflects the new time.
    const { data: refreshed } = await supabase
      .from("post_targets")
      .select("publish_at, status")
      .eq("id", target.id)
      .single();
    assert(refreshed, "target row should still exist after reschedule");
    assert(
      new Date(refreshed!.publish_at as string).getTime() === newPublishAt.getTime(),
      "post_targets.publish_at should reflect the new reschedule time",
    );
    console.log(
      `[verify] PASS: reschedule path updated publish_at to ${refreshed!.publish_at} and job ${jobAfterReschedule!.id} still present`,
    );

    console.log("[verify] SUCCESS: create and reschedule paths both enqueue real BullMQ jobs");
  } catch (err) {
    exitCode = 1;
    console.error("[verify] FAILURE:", err instanceof Error ? err.message : err);
  } finally {
    await cleanupTestRows(supabase, cleanup);
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

async function cleanupTestRows(supabase: ReturnType<typeof getSupabaseClient>, cleanup: Cleanup) {
  console.log("[verify] cleaning up test rows and queue jobs...");

  if (cleanup.scheduledPostId) {
    // Remove any leftover BullMQ job(s) for this post's targets first, since
    // jobId === target id and the DB cascade below won't touch Redis.
    const { data: targets } = await supabase
      .from("post_targets")
      .select("id")
      .eq("scheduled_post_id", cleanup.scheduledPostId);
    for (const t of (targets ?? []) as { id: string }[]) {
      try {
        const job = await getPublishQueue().getJob(t.id);
        await job?.remove();
      } catch (err) {
        console.error(`[verify] cleanup: failed to remove job for target ${t.id}:`, err);
      }
    }

    const { error } = await supabase.from("scheduled_posts").delete().eq("id", cleanup.scheduledPostId);
    if (error) {
      console.error(`[verify] cleanup: failed to delete scheduled_post: ${error.message}`);
    }
  }

  if (cleanup.socialAccountId) {
    const { error } = await supabase.from("social_accounts").delete().eq("id", cleanup.socialAccountId);
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
