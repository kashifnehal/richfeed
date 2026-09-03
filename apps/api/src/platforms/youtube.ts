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

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_INIT_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const TITLE_MAX_LENGTH = 100;
// "People & Blogs" — YouTube requires a categoryId; there's no per-post
// category input in RichFeed today, so every upload gets the same one.
const CATEGORY_ID = "22";

function assertSupportedMedia(post: PublishPost): void {
  if (post.mediaType !== "video") {
    throw new PlatformPublishError("YouTube only supports video posts.", false);
  }
}

function deriveTitle(caption: string | null): string {
  const firstLine = (caption ?? "").split("\n")[0]?.trim() ?? "";
  return firstLine.length > 0 ? firstLine.slice(0, TITLE_MAX_LENGTH) : "Untitled";
}

/** Google doesn't rotate the refresh token on use the way X does, but re-persists whatever comes back regardless. */
async function refreshAccessToken(account: PublishAccount): Promise<string> {
  if (!account.refreshToken) {
    throw new PlatformPublishError("YouTube connection has no refresh token; reconnect required.", true);
  }

  const clientId = requireEnv("YOUTUBE_CLIENT_ID");
  const clientSecret = requireEnv("YOUTUBE_CLIENT_SECRET");
  const existingRefreshToken = decrypt(account.refreshToken);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: existingRefreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    throw new PlatformPublishError(`YouTube token refresh failed (${res.status})`, true, res.status);
  }

  const body = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };

  await updateSocialAccountTokens(account.id, {
    accessTokenEncrypted: encrypt(body.access_token),
    refreshTokenEncrypted: encrypt(body.refresh_token ?? existingRefreshToken),
    tokenExpiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
  });

  return body.access_token;
}

async function getValidAccessToken(account: PublishAccount): Promise<string> {
  const expired = !account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() <= Date.now();
  return expired ? refreshAccessToken(account) : decrypt(account.accessToken);
}

async function throwYouTubeError(res: Response): Promise<never> {
  let message = `YouTube API error (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) message = body.error.message;
  } catch {
    // no JSON body — keep the generic message
  }
  throw new PlatformPublishError(message, res.status === 401 || res.status === 403, res.status);
}

export async function publishToYouTube(
  account: PublishAccount,
  target: PublishTarget,
  post: PublishPost,
): Promise<PublishResult> {
  assertSupportedMedia(post);
  if (!post.mediaUrls || post.mediaUrls.length === 0) {
    throw new PlatformPublishError("YouTube post is missing its video file.", false);
  }

  const accessToken = await getValidAccessToken(account);
  const caption = target.platformCaptionOverride ?? post.caption ?? "";
  const description = [caption, post.hashtags?.join(" ")].filter(Boolean).join("\n\n");

  const videoRes = await fetch(post.mediaUrls[0]!);
  if (!videoRes.ok) {
    throw new PlatformPublishError(`Failed to fetch post video for upload (${videoRes.status})`, false, videoRes.status);
  }
  const contentType = videoRes.headers.get("content-type") ?? "video/mp4";
  const bytes = await videoRes.arrayBuffer();

  // privacyStatus MUST be "private" (not "unlisted") for status.publishAt
  // scheduling to actually work — YouTube flips it public at that exact
  // time. If publishAt is already in the past, YouTube publishes
  // immediately, which is expected, not a bug.
  const initRes = await fetch(UPLOAD_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Length": String(bytes.byteLength),
      "X-Upload-Content-Type": contentType,
    },
    body: JSON.stringify({
      snippet: { title: deriveTitle(caption), description, categoryId: CATEGORY_ID },
      status: { privacyStatus: "private", publishAt: target.publishAt },
    }),
  });
  if (!initRes.ok) await throwYouTubeError(initRes);

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new PlatformPublishError("YouTube didn't return an upload session URL", false, initRes.status);
  }

  // A single PUT with the full video — chunked upload is only for
  // unreliable connections per Google's current guidance, not the default
  // path here.
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "Content-Length": String(bytes.byteLength) },
    body: bytes,
  });
  if (!uploadRes.ok) await throwYouTubeError(uploadRes);

  const uploaded = (await uploadRes.json()) as { id: string };
  return { platformPostId: uploaded.id, permalinkUrl: `https://www.youtube.com/watch?v=${uploaded.id}` };
}
