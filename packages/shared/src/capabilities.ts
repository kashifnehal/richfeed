/**
 * Per-platform media capability matrix.
 *
 * This is the single source of truth for "can this media type be scheduled
 * to this platform?" — imported by both the API (schedule-time 400) and the
 * web app (compose UI). The six live adapters' `assertSupportedMedia()`
 * guards MUST call `unsupportedMediaReason()` rather than re-hardcoding the
 * same checks, so this file cannot drift from publish-time rejection.
 *
 * Mirrors the adapter behavior in apps/api/src/platforms/{linkedin,facebook,
 * threads,x,instagram,youtube}.ts, not a wishlist. Instagram video is
 * allowed here because the adapter allows it (the live Meta 400 is a
 * separate publish-time bug). TikTok / Pinterest / LinkedIn Company Pages /
 * Reddit have no adapter — treated as unsupported.
 */
import type { MediaType, Platform } from "./types";

/** The four shapes a scheduled post can take. `text` = no media attached. */
export type MediaKind = "text" | "image" | "video" | "carousel";

export interface PlatformMediaCaps {
  text: boolean;
  image: boolean;
  video: boolean;
  carousel: boolean;
}

const TEXT_OR_SINGLE_IMAGE: PlatformMediaCaps = {
  text: true,
  image: true,
  video: false,
  carousel: false,
};

/**
 * `null` means no publish adapter exists for that platform. Every in-scope
 * platform with a real adapter has an explicit row.
 */
export const PLATFORM_MEDIA_CAPS: Record<Platform, PlatformMediaCaps | null> = {
  linkedin_personal: TEXT_OR_SINGLE_IMAGE,
  facebook: TEXT_OR_SINGLE_IMAGE,
  threads: TEXT_OR_SINGLE_IMAGE,
  twitter: TEXT_OR_SINGLE_IMAGE,
  instagram: { text: false, image: true, video: true, carousel: false },
  youtube: { text: false, image: false, video: true, carousel: false },
  linkedin_org: null,
  tiktok: null,
  pinterest: null,
  reddit: null,
};

const PLATFORM_DISPLAY: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X",
  linkedin_personal: "LinkedIn",
  linkedin_org: "LinkedIn Company Pages",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  threads: "Threads",
  reddit: "Reddit",
};

export function mediaKindFromType(mediaType: MediaType | null | undefined): MediaKind {
  if (mediaType === "image" || mediaType === "video" || mediaType === "carousel") {
    return mediaType;
  }
  return "text";
}

export function mediaKindLabel(mediaType: MediaType | null | undefined): string {
  switch (mediaKindFromType(mediaType)) {
    case "text":
      return "text-only posts";
    case "image":
      return "single-image posts";
    case "video":
      return "video posts";
    case "carousel":
      return "carousel posts";
  }
}

export function isMediaSupportedOnPlatform(
  platform: Platform,
  mediaType: MediaType | null | undefined,
): boolean {
  const caps = PLATFORM_MEDIA_CAPS[platform];
  if (!caps) return false;
  return caps[mediaKindFromType(mediaType)];
}

/**
 * Full rejection sentence, matching (and now owned by) each adapter's
 * `assertSupportedMedia()` message. Null if the combo is allowed.
 */
export function unsupportedMediaReason(
  platform: Platform,
  mediaType: MediaType | null | undefined,
): string | null {
  if (isMediaSupportedOnPlatform(platform, mediaType)) return null;

  const caps = PLATFORM_MEDIA_CAPS[platform];
  if (!caps) {
    return `RichFeed can't publish to ${PLATFORM_DISPLAY[platform]} yet.`;
  }

  switch (platform) {
    case "linkedin_personal":
      return "LinkedIn publishing only supports text-only or single-image posts right now — video and carousel aren't supported yet.";
    case "facebook":
      return "Facebook Page publishing only supports text-only or single-image posts right now — video and carousel aren't supported yet.";
    case "threads":
      return "Threads publishing only supports text-only or single-image posts right now — video and carousel aren't supported yet.";
    case "twitter":
      return "X publishing only supports text-only or single-image posts right now — video and carousel aren't supported yet.";
    case "instagram":
      return "Instagram posts need an image or video attached — text-only and carousel aren't supported yet.";
    case "youtube":
      return "YouTube only supports video posts.";
    default:
      return `${PLATFORM_DISPLAY[platform]} doesn't support ${mediaKindLabel(mediaType)}.`;
  }
}

export interface UnsupportedMediaFailure {
  platform: Platform;
  reason: string;
}

export function collectUnsupportedMedia(
  platforms: readonly Platform[],
  mediaType: MediaType | null | undefined,
): UnsupportedMediaFailure[] {
  const seen = new Set<Platform>();
  const failures: UnsupportedMediaFailure[] = [];
  for (const platform of platforms) {
    if (seen.has(platform)) continue;
    seen.add(platform);
    const reason = unsupportedMediaReason(platform, mediaType);
    if (reason) failures.push({ platform, reason });
  }
  return failures;
}

export function formatUnsupportedMediaError(failures: readonly UnsupportedMediaFailure[]): string {
  const first = failures[0];
  if (!first) return "This media type isn't supported on the selected account.";
  if (failures.length === 1) return first.reason;
  return failures.map((f) => f.reason).join(" ");
}

export class UnsupportedMediaError extends Error {
  readonly failures: readonly UnsupportedMediaFailure[];

  constructor(failures: readonly UnsupportedMediaFailure[]) {
    super(formatUnsupportedMediaError(failures));
    this.name = "UnsupportedMediaError";
    this.failures = failures;
  }
}

export function throwIfUnsupportedMedia(
  platforms: readonly Platform[],
  mediaType: MediaType | null | undefined,
): void {
  const failures = collectUnsupportedMedia(platforms, mediaType);
  if (failures.length > 0) {
    throw new UnsupportedMediaError(failures);
  }
}

/** Null when every platform accepts this media; otherwise the 400 / inline error text. */
export function unsupportedMediaErrorMessage(
  platforms: readonly Platform[],
  mediaType: MediaType | null | undefined,
): string | null {
  const failures = collectUnsupportedMedia(platforms, mediaType);
  return failures.length > 0 ? formatUnsupportedMediaError(failures) : null;
}
