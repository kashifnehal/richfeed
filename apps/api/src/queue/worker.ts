import { Worker, type Job } from "bullmq";
import {
  getPostTarget,
  recordPublishAttempt,
  updatePostTargetStatus,
} from "../db/queries";
import { getRedisConnection } from "./connection";
import { QUEUE_NAME, type PublishJobPayload } from "./scheduler";

/**
 * Processes a single publish job: pending -> publishing -> published (or
 * failed on error). No real platform integration exists yet — see the TODO
 * below.
 */
async function processPublishJob(job: Job<PublishJobPayload>): Promise<void> {
  const { postTargetId } = job.data;

  try {
    const target = await getPostTarget(postTargetId);
    if (!target) {
      throw new Error(`post_target ${postTargetId} not found`);
    }

    await updatePostTargetStatus(postTargetId, "publishing");

    // TODO(Step 3+): replace this with a real platform adapter call, per
    // platform, per doc 35 §1 (Instagram/Facebook/LinkedIn/etc. publish
    // APIs). For now we simulate network latency and always succeed.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const fakePlatformPostId = `stub_${postTargetId.slice(0, 8)}_${Date.now()}`;

    await updatePostTargetStatus(postTargetId, "published", fakePlatformPostId);
    await recordPublishAttempt(postTargetId, {
      httpStatus: 200,
      attemptNumber: 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await updatePostTargetStatus(postTargetId, "failed");
    await recordPublishAttempt(postTargetId, {
      errorCode: "PUBLISH_FAILED",
      errorMessage: message,
      attemptNumber: 1,
    });

    throw err;
  }
}

let worker: Worker<PublishJobPayload> | undefined;

/**
 * Start the BullMQ worker that processes post-publish jobs. Safe to call
 * once per process (apps/api/src/worker-entry.ts is the intended entry
 * point).
 */
export function startWorker(): Worker<PublishJobPayload> {
  if (worker) return worker;

  worker = new Worker<PublishJobPayload>(QUEUE_NAME, processPublishJob, {
    connection: getRedisConnection(),
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[worker] job ${job?.id} (post_target ${job?.data.postTargetId}) failed: ${err.message}`,
    );
  });

  worker.on("completed", (job) => {
    console.log(
      `[worker] job ${job.id} (post_target ${job.data.postTargetId}) completed`,
    );
  });

  return worker;
}
