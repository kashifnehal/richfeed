import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const QUEUE_NAME = "post-publish";

export interface PublishJobPayload {
  postTargetId: string;
}

let queue: Queue<PublishJobPayload> | undefined;

/**
 * Lazily build the BullMQ queue on top of Step 1's Redis connection factory.
 * Nothing touches Redis until this is actually called.
 */
export function getPublishQueue(): Queue<PublishJobPayload> {
  if (queue) return queue;

  queue = new Queue<PublishJobPayload>(QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  return queue;
}

// Per doc 35 §3.3: jobs are delayed with a small random jitter (2-5 minutes)
// applied on top of the user's chosen publish time. The jitter is purely an
// execution-time implementation detail to spread load — the user always
// sees their exact chosen time in the UI, never the jittered one.
const MIN_JITTER_MS = 2 * 60 * 1000;
const MAX_JITTER_MS = 5 * 60 * 1000;

function randomJitterMs(): number {
  return MIN_JITTER_MS + Math.random() * (MAX_JITTER_MS - MIN_JITTER_MS);
}

export interface EnqueuePublishJobOptions {
  /**
   * Test-only escape hatch: skip the 2-5 minute production jitter so a live
   * end-to-end test (see src/scripts/verify-pipeline.ts) can observe a
   * pending -> publishing -> published transition within a short polling
   * window instead of waiting minutes. Defaults to the
   * DISABLE_PUBLISH_JITTER env var so the script doesn't need to import
   * internals, but can also be set explicitly by callers. Never set this in
   * production — the jitter exists to spread publish load, per doc 35 §3.3.
   */
  disableJitter?: boolean;
}

/**
 * Enqueue a publish job for postTargetId, delayed until publishAt (clamped
 * to 0 if publishAt is already in the past) plus a random 2-5 minute jitter.
 */
export async function enqueuePublishJob(
  postTargetId: string,
  publishAt: Date,
  options?: EnqueuePublishJobOptions,
) {
  const disableJitter =
    options?.disableJitter ?? process.env.DISABLE_PUBLISH_JITTER === "true";

  const baseDelayMs = Math.max(0, publishAt.getTime() - Date.now());
  const jitterMs = disableJitter ? 0 : randomJitterMs();
  const delay = Math.round(baseDelayMs + jitterMs);

  return getPublishQueue().add(
    "publish",
    { postTargetId },
    // removeOnFail: false kept failed jobs (and their data) in Redis forever.
    // A failed job's history is already durably recorded in Postgres
    // (publish_attempts / post_targets.status) via processPublishJob, so
    // Redis only needs to keep the most recent few for operator visibility.
    { delay, removeOnComplete: true, removeOnFail: { count: 50 } },
  );
}
