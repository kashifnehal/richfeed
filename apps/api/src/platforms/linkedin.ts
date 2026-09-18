import { resolvePlatformCaption, unsupportedMediaReason } from "@richfeed/shared";
import { decrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { logPlatformApiError, readResponseBody } from "../lib/log-platform-error";
import { requireCarouselImageUrls } from "./carousel-urls";
import {
  PlatformPublishError,
  type PublishAccount,
  type PublishPost,
  type PublishResult,
  type PublishTarget,
} from "./types";

const POSTS_URL = "https://api.linkedin.com/rest/posts";
const IMAGES_URL = "https://api.linkedin.com/rest/images?action=initializeUpload";

function assertSupportedMedia(post: PublishPost): void {
  const reason = unsupportedMediaReason("linkedin_personal", post.mediaType, post.mediaUrls?.length);
  if (reason) throw new PlatformPublishError(reason, false);
}

function linkedinHeaders(accessToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": requireEnv("LINKEDIN_API_VERSION"),
  };
}

async function throwLinkedInError(res: Response): Promise<never> {
  const parsed = await readResponseBody(res);
  logPlatformApiError("linkedin", res.status, res.url, parsed);

  let message = `LinkedIn API error (${res.status})`;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const body = parsed as { message?: string };
    if (typeof body.message === "string" && body.message.length > 0) message = body.message;
  } else if (typeof parsed === "string" && parsed.length > 0) {
    message = parsed.slice(0, 500);
  }
  throw new PlatformPublishError(message, res.status === 401 || res.status === 403, res.status);
}

/** Uploads one image and returns its LinkedIn image URN, for a post's "content.media.id". */
async function uploadImage(accessToken: string, authorUrn: string, imageUrl: string): Promise<string> {
  const initRes = await fetch(IMAGES_URL, {
    method: "POST",
    headers: linkedinHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  if (!initRes.ok) await throwLinkedInError(initRes);

  const initBody = (await initRes.json()) as { value: { uploadUrl: string; image: string } };

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new PlatformPublishError(`Failed to fetch post image for upload (${imageRes.status})`, false, imageRes.status);
  }
  const bytes = await imageRes.arrayBuffer();

  const uploadRes = await fetch(initBody.value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!uploadRes.ok) {
    throw new PlatformPublishError(`LinkedIn image upload failed (${uploadRes.status})`, false, uploadRes.status);
  }

  return initBody.value.image;
}

export async function publishToLinkedIn(
  account: PublishAccount,
  target: PublishTarget,
  post: PublishPost,
): Promise<PublishResult> {
  assertSupportedMedia(post);

  // LinkedIn's self-serve personal-profile OAuth doesn't reliably return a
  // refresh_token, and there's no rotation to do here regardless — a stale
  // token just needs a real reconnect (401/403 below).
  const accessToken = decrypt(account.accessToken);
  const authorUrn = `urn:li:person:${account.platformAccountId}`;
  const commentary = resolvePlatformCaption(target.platformCaptionOverride, post.caption);

  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (post.mediaType === "carousel") {
    const urls = requireCarouselImageUrls("linkedin_personal", post);
    const images: { id: string }[] = [];
    for (const url of urls) {
      images.push({ id: await uploadImage(accessToken, authorUrn, url) });
    }
    // Organic multi-image uses Posts API content.multiImage (2–20 image URNs).
    // LinkedIn's sponsored Carousel API is a different product and is not used.
    body.content = { multiImage: { images } };
  } else if (post.mediaType === "image" && post.mediaUrls && post.mediaUrls.length > 0) {
    body.content = { media: { id: await uploadImage(accessToken, authorUrn, post.mediaUrls[0]!) } };
  }

  const res = await fetch(POSTS_URL, {
    method: "POST",
    headers: linkedinHeaders(accessToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) await throwLinkedInError(res);

  // LinkedIn returns the created post's URN in a response header, not the body.
  const platformPostId = res.headers.get("x-restli-id");
  if (!platformPostId) {
    throw new PlatformPublishError("LinkedIn didn't return a post id (missing x-restli-id header)", false, res.status);
  }

  // Not a documented LinkedIn permalink pattern — treat a failure to
  // resolve as expected-possible, not a bug (see platforms/linkedin.md).
  return {
    platformPostId,
    permalinkUrl: `https://www.linkedin.com/feed/update/${platformPostId}/`,
  };
}
