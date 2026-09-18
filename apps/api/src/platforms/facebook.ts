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

const GRAPH_VERSION = "v21.0";

function assertSupportedMedia(post: PublishPost): void {
  const reason = unsupportedMediaReason("facebook", post.mediaType, post.mediaUrls?.length);
  if (reason) throw new PlatformPublishError(reason, false);
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
  const message = resolvePlatformCaption(target.platformCaptionOverride, post.caption);

  if (post.mediaType === "carousel") {
    return publishFacebookCarousel(account.platformAccountId, pageAccessToken, message, post);
  }

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

/**
 * Multi-photo Page post: unpublished photo uploads, then one /feed post with
 * attached_media[]. 2–10 images. Caption lives on the feed post, not the
 * unpublished photos (those expire ~24h if never attached).
 */
async function publishFacebookCarousel(
  pageId: string,
  pageAccessToken: string,
  message: string,
  post: PublishPost,
): Promise<PublishResult> {
  const urls = requireCarouselImageUrls("facebook", post);
  const photoIds: string[] = [];

  for (const url of urls) {
    const upload = new URLSearchParams({
      access_token: pageAccessToken,
      url,
      published: "false",
    });
    const uploadRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: upload,
    });
    if (!uploadRes.ok) throw await buildMetaError(uploadRes);
    const uploaded = (await uploadRes.json()) as { id: string };
    photoIds.push(uploaded.id);
  }

  const feed = new URLSearchParams({ access_token: pageAccessToken, message });
  photoIds.forEach((id, index) => {
    feed.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: id }));
  });

  const feedRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: feed,
  });
  if (!feedRes.ok) throw await buildMetaError(feedRes);

  const data = (await feedRes.json()) as { id: string };
  return { platformPostId: data.id, permalinkUrl: `https://www.facebook.com/${data.id}` };
}
