import { decrypt, encrypt } from "../lib/crypto";
import { requireEnv } from "../lib/env";
import { updateSocialAccountTokens } from "../db/queries";
import {
  PlatformPublishError,
  type PublishAccount,
  type PublishPost,
  type PublishResult,
  type PublishTarget,
} from "./types";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_TWEETS_URL = "https://api.x.com/2/tweets";
const X_MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";

/** Text-only + single-image only (see doc scope). Video/carousel fail fast, before any network call. */
function assertSupportedMedia(post: PublishPost): void {
  if (post.mediaType === "video" || post.mediaType === "carousel") {
    throw new PlatformPublishError(
      "X publishing only supports text-only or single-image posts right now — video and carousel aren't supported yet.",
      false,
    );
  }
}

async function extractXError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: string;
      title?: string;
      error?: { message?: string };
      errors?: { message?: string }[];
    };
    const message = body.detail ?? body.title ?? body.error?.message ?? body.errors?.[0]?.message;
    return typeof message === "string" && message.length > 0 ? message : `X API error (${res.status})`;
  } catch {
    return `X API error (${res.status})`;
  }
}

/** X access tokens expire after 2h; refresh (and persist the rotated pair) when expired. */
async function refreshXToken(account: PublishAccount): Promise<string> {
  if (!account.refreshToken) {
    throw new PlatformPublishError("X connection has no refresh token; reconnect required.", true);
  }

  const clientId = requireEnv("X_CLIENT_ID");
  const clientSecret = requireEnv("X_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decrypt(account.refreshToken),
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    throw new PlatformPublishError(`X token refresh failed (${res.status})`, true, res.status);
  }

  const body = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };

  await updateSocialAccountTokens(account.id, {
    accessTokenEncrypted: encrypt(body.access_token),
    refreshTokenEncrypted: encrypt(body.refresh_token),
    tokenExpiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
  });

  return body.access_token;
}

async function getValidAccessToken(account: PublishAccount): Promise<string> {
  const expired = !account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() <= Date.now();
  return expired ? refreshXToken(account) : decrypt(account.accessToken);
}

/** One-shot (non-chunked) image upload — fine for single-image; video needs the chunked INIT/APPEND/FINALIZE flow, which is out of scope. */
async function uploadXMedia(accessToken: string, imageUrl: string): Promise<string> {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new PlatformPublishError(`Failed to fetch post image for upload (${imageRes.status})`, false, imageRes.status);
  }
  const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
  const bytes = await imageRes.arrayBuffer();

  const form = new FormData();
  form.append("media", new Blob([bytes], { type: contentType }), "image");

  const res = await fetch(X_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (res.status === 401 || res.status === 403) {
    throw new PlatformPublishError(`X rejected the media upload (${res.status})`, true, res.status);
  }
  if (!res.ok) {
    throw new PlatformPublishError(await extractXError(res), false, res.status);
  }

  const body = (await res.json()) as { data?: { id?: string }; media_id_string?: string; media_id?: number };
  const mediaId = body.data?.id ?? body.media_id_string ?? (body.media_id !== undefined ? String(body.media_id) : undefined);
  if (!mediaId) {
    throw new PlatformPublishError("X media upload response did not include a media id", false, res.status);
  }
  return mediaId;
}

/** https://x.com/{username}/status/{id} — the pattern the identity call in oauth-x.ts stores platformUsername for. */
export function buildXPermalink(platformUsername: string | null, platformPostId: string): string | undefined {
  if (!platformUsername) return undefined;
  return `https://x.com/${platformUsername}/status/${platformPostId}`;
}

export async function publishToX(
  account: PublishAccount,
  target: PublishTarget,
  post: PublishPost,
): Promise<PublishResult> {
  assertSupportedMedia(post);

  const accessToken = await getValidAccessToken(account);
  const text = target.platformCaptionOverride ?? post.caption ?? "";

  let mediaId: string | undefined;
  if (post.mediaType === "image" && post.mediaUrls && post.mediaUrls.length > 0) {
    mediaId = await uploadXMedia(accessToken, post.mediaUrls[0]!);
  }

  const res = await fetch(X_TWEETS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(mediaId ? { text, media: { media_ids: [mediaId] } } : { text }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new PlatformPublishError(`X rejected the publish request (${res.status})`, true, res.status);
  }
  if (!res.ok) {
    throw new PlatformPublishError(await extractXError(res), false, res.status);
  }

  const body = (await res.json()) as { data: { id: string } };
  return { platformPostId: body.data.id };
}
