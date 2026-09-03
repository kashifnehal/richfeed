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
const MAX_POLL_ATTEMPTS = 10;
const CAPTION_MAX_LENGTH = 2200;

function assertSupportedMedia(post: PublishPost): void {
  // Instagram requires media — there's no pure-text IG post.
  if (post.mediaType !== "image" && post.mediaType !== "video") {
    throw new PlatformPublishError(
      "Instagram posts need an image or video attached — text-only and carousel aren't supported yet.",
      false,
    );
  }
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
    body.set("media_type", "VIDEO");
    body.set("video_url", post.mediaUrls![0]!);
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

/** Images are near-instant; video needs real processing time. Poll either way rather than assuming. */
async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
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
  const caption = target.platformCaptionOverride ?? post.caption ?? "";

  const containerId = await createContainer(account.platformAccountId, accessToken, post, caption);
  await waitForContainerReady(containerId, accessToken);

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
