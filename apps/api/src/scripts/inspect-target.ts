/**
 * Read-only diagnostics for one specific post_target: its Postgres row plus
 * the real BullMQ job (if any) for its id as jobId. Answers "was a job ever
 * created for this target, did the worker ever see it, and if so what
 * happened" without hand-writing psql + a BullMQ script each time.
 *
 * Run with:
 *   tsx --env-file-if-exists=.env src/scripts/inspect-target.ts <scheduled_post_id>
 *
 * Uses the service-role client (bypasses RLS) and the real worker Redis
 * connection. Never mutates anything — no queue.add/remove, no DB writes.
 */

import { getSupabaseClient } from "../db/supabase";
import { getPublishQueue, publishJobId } from "../queue/scheduler";
import { getRedisConnection } from "../queue/connection";

async function main() {
  const scheduledPostId = process.argv[2];
  if (!scheduledPostId) {
    console.error("usage: inspect-target.ts <scheduled_post_id>");
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const queue = getPublishQueue();

  try {
    const { data: targets, error } = await supabase
      .from("post_targets")
      .select(
        "id, status, publish_at, created_at, updated_at, platform_post_id, permalink_url, social_accounts(platform, display_name)",
      )
      .eq("scheduled_post_id", scheduledPostId);

    if (error) throw new Error(`post_targets query failed: ${error.message}`);
    if (!targets?.length) {
      console.log(`no post_targets found for scheduled_post_id=${scheduledPostId}`);
      return;
    }

    for (const t of targets) {
      const acct = t.social_accounts as { platform?: string; display_name?: string } | null;
      console.log(`\n=== post_target ${t.id} (${acct?.platform} / ${acct?.display_name}) ===`);
      console.log(`  status:      ${t.status}`);
      console.log(`  publish_at:  ${t.publish_at}  (raw value as returned by supabase-js)`);
      console.log(`  created_at:  ${t.created_at}`);
      console.log(`  updated_at:  ${t.updated_at}`);
      console.log(`  platform_post_id: ${t.platform_post_id ?? "-"}`);
      console.log(`  permalink_url:    ${t.permalink_url ?? "-"}`);

      const { data: attempts } = await supabase
        .from("publish_attempts")
        .select("attempt_number, attempted_at, http_status, error_code, error_message")
        .eq("post_target_id", t.id)
        .order("attempted_at", { ascending: true });
      if (attempts?.length) {
        console.log(`  publish_attempts:`);
        for (const a of attempts) {
          console.log(
            `    #${a.attempt_number} @ ${a.attempted_at}  http=${a.http_status ?? "-"}  ${a.error_code ?? "ok"}  ${a.error_message ?? ""}`,
          );
        }
      } else {
        console.log(`  publish_attempts: none`);
      }

      const jobId = publishJobId(t.id);
      const job = await queue.getJob(jobId);
      if (!job) {
        console.log(`  BullMQ job (id=${jobId}): NOT FOUND (no job currently exists for this jobId)`);
      } else {
        const state = await job.getState();
        console.log(`  BullMQ job (id=${jobId}): FOUND, state=${state}`);
        console.log(`    delay:        ${job.opts.delay}ms`);
        console.log(`    timestamp:    ${job.timestamp} (${new Date(job.timestamp).toISOString()})`);
        console.log(`    processedOn:  ${job.processedOn ?? "-"}${job.processedOn ? ` (${new Date(job.processedOn).toISOString()})` : ""}`);
        console.log(`    finishedOn:   ${job.finishedOn ?? "-"}${job.finishedOn ? ` (${new Date(job.finishedOn).toISOString()})` : ""}`);
        console.log(`    attemptsMade: ${job.attemptsMade}`);
        console.log(`    failedReason: ${job.failedReason ?? "-"}`);
      }
    }

    // Cross-check the failed/delayed sets for any leftover reference to these
    // target ids, in case a job existed under a different lookup path.
    const targetIds = new Set(targets.map((t) => t.id as string));
    const [failed, delayed] = await Promise.all([queue.getFailed(), queue.getDelayed()]);
    const failedHits = failed.filter((j) => targetIds.has(j.id ?? ""));
    const delayedHits = delayed.filter((j) => targetIds.has(j.id ?? ""));
    console.log(`\nqueue.getFailed() total=${failed.length}, matching this post's targets: ${failedHits.length}`);
    for (const j of failedHits) {
      console.log(`  failed job ${j.id}: failedReason=${j.failedReason ?? "-"}`);
    }
    console.log(`queue.getDelayed() total=${delayed.length}, matching this post's targets: ${delayedHits.length}`);
    for (const j of delayedHits) {
      console.log(`  delayed job ${j.id}: delay=${j.opts.delay}ms timestamp=${new Date(j.timestamp).toISOString()}`);
    }
  } finally {
    try {
      await queue.close();
    } catch {
      // best-effort
    }
    try {
      getRedisConnection().disconnect();
    } catch {
      // best-effort
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
