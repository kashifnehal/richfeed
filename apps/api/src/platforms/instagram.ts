import { resolvePlatformCaption, unsupportedMediaReason } from "@richfeed/shared";
import { decrypt } from "../lib/crypto";
import { buildMetaError } from "./meta-shared";
import {
  PlatformPublishError,
  type PublishAccount,
  type PublishPost,
  type PublishResult,
  type PublishTarget,
} from "./types";

// The standalone "Instagram API with Instagram Login" product (this app's
// setup) publishes through graph.instagram.com — NOT graph.facebook.com,
// which is the older Facebook-Login-for-Business-linked flow this project
// isn't using. Confirm against current Meta docs before changing this host.
const GRAPH_HOST = "graph.instagram.com";
const GRAPH_VERSION = "v21.0";
const POLL_INTERVAL_MS = 2000;
const IMAGE_POLL_ATTEMPTS = 10;
// Reels processing is slower than images; 20s was enough to *create* a
// container but not always enough to reach FINISHED.
const VIDEO_POLL_ATTEMPTS = 30;
const CAPTION_MAX_LENGTH = 2200;

function assertSupportedMedia(post: PublishPost): void {
  const reason = unsupportedMediaReason("instagram", post.mediaType);
  if (reason) throw new PlatformPublishError(reason, false);
}

async function createContainer(
  igUserId: string,
  accessToken: string,
  post: PublishPost,
  caption: string,
): Promise<string> {
  const body = new URLSearchParams({
    access_token: accessToken,
    caption: caption.slice(0, CAPTION_MAX_LENGTH),
  });
  if (post.mediaType === "video") {
    // Meta deprecated media_type=VIDEO (error_subcode 2207067, 2026-09-17 live
    // 400). Reels are the replacement; share_to_feed=true keeps it eligible
    // for the main feed as well as the Reels tab.
    body.set("media_type", "REELS");
    body.set("video_url", post.mediaUrls![0]!);
    body.set("share_to_feed", "true");
  } else {
    body.set("image_url", post.mediaUrls![0]!);
  }

  const res = await fetch(`https://${GRAPH_HOST}/${GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw await buildMetaError(res);

  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Images are near-instant; reels need real processing time. Poll either way rather than assuming. */
async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  maxAttempts: number,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `https://${GRAPH_HOST}/${GRAPH_VERSION}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) throw await buildMetaError(res);

    const data = (await res.json()) as { status_code: string };
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new PlatformPublishError(`Instagram media processing failed (${data.status_code})`, false);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new PlatformPublishError("Instagram media took too long to process", false);
}

export async function publishToInstagram(
  account: PublishAccount,
  target: PublishTarget,
  post: PublishPost,
): Promise<PublishResult> {
  assertSupportedMedia(post);

  const accessToken = decrypt(account.accessToken);
  const caption = resolvePlatformCaption(target.platformCaptionOverride, post.caption);

  const containerId = await createContainer(account.platformAccountId, accessToken, post, caption);
  await waitForContainerReady(
    containerId,
    accessToken,
    post.mediaType === "video" ? VIDEO_POLL_ATTEMPTS : IMAGE_POLL_ATTEMPTS,
  );

  const publishRes = await fetch(`https://${GRAPH_HOST}/${GRAPH_VERSION}/${account.platformAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) throw await buildMetaError(publishRes);

  const platformPostId = ((await publishRes.json()) as { id: string }).id;

  // Best-effort — a missing permalink shouldn't fail an otherwise-successful publish.
  let permalinkUrl: string | undefined;
  try {
    const permalinkRes = await fetch(
      `https://${GRAPH_HOST}/${GRAPH_VERSION}/${platformPostId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (permalinkRes.ok) {
      permalinkUrl = ((await permalinkRes.json()) as { permalink?: string }).permalink;
    }
  } catch {
    // keep permalinkUrl undefined
  }

  return { platformPostId, permalinkUrl };
}
