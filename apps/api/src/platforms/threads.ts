import { resolvePlatformCaption, unsupportedMediaReason } from "@richfeed/shared";
import { decrypt } from "../lib/crypto";
import { requireCarouselImageUrls } from "./carousel-urls";
import { buildMetaError } from "./meta-shared";
import {
  PlatformPublishError,
  type PublishAccount,
  type PublishPost,
  type PublishResult,
  type PublishTarget,
} from "./types";

const GRAPH_HOST = "graph.threads.net";
const GRAPH_VERSION = "v1.0";
// Meta's own guidance: wait before publishing a just-created container,
// rather than firing immediately.
const PUBLISH_DELAY_MS = 30_000;
// Documented limits: text <=500 chars, images JPEG/PNG <=8MB. Only the text
// length is enforced here (truncated) — image size/type isn't checked
// client-side; a violation surfaces as a real Graph API error instead.
const TEXT_MAX_LENGTH = 500;

function assertSupportedMedia(post: PublishPost): void {
  const reason = unsupportedMediaReason("threads", post.mediaType, post.mediaUrls?.length);
  if (reason) throw new PlatformPublishError(reason, false);
}

export async function publishToThreads(
  account: PublishAccount,
  target: PublishTarget,
  post: PublishPost,
): Promise<PublishResult> {
  assertSupportedMedia(post);

  const accessToken = decrypt(account.accessToken);
  const text = resolvePlatformCaption(target.platformCaptionOverride, post.caption).slice(0, TEXT_MAX_LENGTH);

  if (post.mediaType === "carousel") {
    return publishThreadsCarousel(account.platformAccountId, accessToken, text, post);
  }

  const body = new URLSearchParams({ access_token: accessToken, text });
  if (post.mediaType === "image" && post.mediaUrls && post.mediaUrls.length > 0) {
    body.set("media_type", "IMAGE");
    body.set("image_url", post.mediaUrls[0]!);
  } else {
    body.set("media_type", "TEXT");
  }

  const createRes = await fetch(`https://${GRAPH_HOST}/${GRAPH_VERSION}/${account.platformAccountId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!createRes.ok) throw await buildMetaError(createRes);
  const containerId = ((await createRes.json()) as { id: string }).id;

  await new Promise((resolve) => setTimeout(resolve, PUBLISH_DELAY_MS));

  const publishRes = await fetch(`https://${GRAPH_HOST}/${GRAPH_VERSION}/${account.platformAccountId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) throw await buildMetaError(publishRes);
  const platformPostId = ((await publishRes.json()) as { id: string }).id;

  // Best-effort — Threads may omit the permalink entirely (e.g. a
  // copyright-flagged post); a missing one shouldn't fail the publish.
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

/**
 * Threads carousel mirrors Instagram's container flow on graph.threads.net:
 * child containers with media_type=IMAGE + is_carousel_item=true, then a
 * parent with media_type=CAROUSEL + children=<comma-separated ids> + text,
 * then the existing 30s wait and /threads_publish. 2–20 items. Caption
 * field is `text` (not Instagram's `caption`). Single-image/text paths
 * above are untouched.
 */
async function publishThreadsCarousel(
  threadsUserId: string,
  accessToken: string,
  text: string,
  post: PublishPost,
): Promise<PublishResult> {
  const urls = requireCarouselImageUrls("threads", post);
  const childIds: string[] = [];

  for (const imageUrl of urls) {
    const childBody = new URLSearchParams({
      access_token: accessToken,
      media_type: "IMAGE",
      image_url: imageUrl,
      is_carousel_item: "true",
    });
    const childRes = await fetch(`https://${GRAPH_HOST}/${GRAPH_VERSION}/${threadsUserId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: childBody,
    });
    if (!childRes.ok) throw await buildMetaError(childRes);
    childIds.push(((await childRes.json()) as { id: string }).id);
  }

  const parentBody = new URLSearchParams({
    access_token: accessToken,
    media_type: "CAROUSEL",
    children: childIds.join(","),
    text,
  });
  const parentRes = await fetch(`https://${GRAPH_HOST}/${GRAPH_VERSION}/${threadsUserId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parentBody,
  });
  if (!parentRes.ok) throw await buildMetaError(parentRes);
  const containerId = ((await parentRes.json()) as { id: string }).id;

  await new Promise((resolve) => setTimeout(resolve, PUBLISH_DELAY_MS));

  const publishRes = await fetch(`https://${GRAPH_HOST}/${GRAPH_VERSION}/${threadsUserId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) throw await buildMetaError(publishRes);
  const platformPostId = ((await publishRes.json()) as { id: string }).id;

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
