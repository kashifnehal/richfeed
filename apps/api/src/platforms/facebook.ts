import { decrypt } from "../lib/crypto";
import { buildMetaError } from "./meta-shared";
import {
  PlatformPublishError,
  type PublishAccount,
  type PublishPost,
  type PublishResult,
  type PublishTarget,
} from "./types";

const GRAPH_VERSION = "v21.0";

function assertSupportedMedia(post: PublishPost): void {
  if (post.mediaType === "video" || post.mediaType === "carousel") {
    throw new PlatformPublishError(
      "Facebook Page publishing only supports text-only or single-image posts right now — video and carousel aren't supported yet.",
      false,
    );
  }
}

/**
 * account.accessToken is the Page access token from Task 1's picker
 * (oauth-facebook.ts) — never a user token, and there's no refresh_token to
 * rotate (a Page token obtained via the long-lived user token exchange is
 * effectively non-expiring; an auth failure here means it was revoked, not
 * that it needs refreshing, so it goes straight to needs_reconnect).
 */
export async function publishToFacebook(
  account: PublishAccount,
  target: PublishTarget,
  post: PublishPost,
): Promise<PublishResult> {
  assertSupportedMedia(post);

  const pageAccessToken = decrypt(account.accessToken);
  const message = target.platformCaptionOverride ?? post.caption ?? "";
  const isPhoto = post.mediaType === "image" && !!post.mediaUrls && post.mediaUrls.length > 0;

  const url = isPhoto
    ? `https://graph.facebook.com/${GRAPH_VERSION}/${account.platformAccountId}/photos`
    : `https://graph.facebook.com/${GRAPH_VERSION}/${account.platformAccountId}/feed`;

  const body = new URLSearchParams({ access_token: pageAccessToken });
  if (isPhoto) {
    body.set("url", post.mediaUrls![0]!);
    body.set("caption", message);
  } else {
    body.set("message", message);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw await buildMetaError(res);
  }

  // A photo post's `id` is the photo object, not the Page post — `post_id`
  // (present on a photo response, absent on a plain feed response) is the
  // actual post identifier the permalink pattern below expects.
  const data = (await res.json()) as { id: string; post_id?: string };
  const platformPostId = data.post_id ?? data.id;

  return { platformPostId, permalinkUrl: `https://www.facebook.com/${platformPostId}` };
}
