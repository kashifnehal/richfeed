import { Worker, type Job } from "bullmq";
import {
  getPublishJobContext,
  markSocialAccountNeedsReconnect,
  recordPublishAttempt,
  updatePostTargetStatus,
} from "../db/queries";
import { publishToFacebook } from "../platforms/facebook";
import { publishToInstagram } from "../platforms/instagram";
import { publishToLinkedIn } from "../platforms/linkedin";
import { publishToThreads } from "../platforms/threads";
import {
  PlatformPublishError,
  type PublishAccount,
  type PublishPost,
  type PublishResult,
  type PublishTarget,
} from "../platforms/types";
import { publishToX } from "../platforms/x";
import { publishToYouTube } from "../platforms/youtube";
import { getRedisConnection } from "./connection";
import { QUEUE_NAME, type PublishJobPayload } from "./scheduler";

type PublishAdapter = (account: PublishAccount, target: PublishTarget, post: PublishPost) => Promise<PublishResult>;

const ADAPTERS: Partial<Record<string, PublishAdapter>> = {
  twitter: publishToX,
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  threads: publishToThreads,
  linkedin_personal: publishToLinkedIn,
  youtube: publishToYouTube,
};

/**
 * Processes a single publish job: pending -> publishing -> published (or
 * failed), dispatched to a real platform adapter via ADAPTERS. Any platform
 * without an adapter yet still uses the simulated stub.
 */
async function processPublishJob(job: Job<PublishJobPayload>): Promise<void> {
  const { postTargetId } = job.data;

  const context = await getPublishJobContext(postTargetId);
  if (!context) {
    throw new Error(`post_target ${postTargetId} not found`);
  }
  const { target, post, account } = context;

  await updatePostTargetStatus(postTargetId, "publishing");

  try {
    const adapter = ADAPTERS[account.platform];

    if (adapter) {
      const result = await adapter(
        {
          id: account.id,
          platformAccountId: account.platform_account_id,
          platformUsername: account.platform_username,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          tokenExpiresAt: account.token_expires_at,
        },
        { id: target.id, platformCaptionOverride: target.platform_caption_override, publishAt: target.publish_at },
        { caption: post.caption, hashtags: post.hashtags, mediaUrls: post.mediaUrls, mediaType: post.mediaType },
      );

      await updatePostTargetStatus(postTargetId, "published", result.platformPostId, result.permalinkUrl);
      await recordPublishAttempt(postTargetId, { httpStatus: 201, attemptNumber: 1 });
      return;
    }

    // TODO(next platform adapter): replace this stub with a real call, per
    // platform, per doc 35 §1. For now every platform without an adapter yet
    // simulates network latency and always succeeds.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const fakePlatformPostId = `stub_${postTargetId.slice(0, 8)}_${Date.now()}`;

    await updatePostTargetStatus(postTargetId, "published", fakePlatformPostId);
    await recordPublishAttempt(postTargetId, { httpStatus: 200, attemptNumber: 1 });
  } catch (err) {
    const isAuthFailure = err instanceof PlatformPublishError && err.isAuthFailure;
    const httpStatus = err instanceof PlatformPublishError ? (err.httpStatus ?? null) : null;
    const message = err instanceof Error ? err.message : String(err);

    await updatePostTargetStatus(postTargetId, "failed");
    if (isAuthFailure) {
      await markSocialAccountNeedsReconnect(account.id);
    }
    await recordPublishAttempt(postTargetId, {
      httpStatus,
      errorCode: isAuthFailure ? "AUTH_FAILED" : "PUBLISH_FAILED",
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
