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
 * threads,x,instagram,youtube}.ts, not a wishlist. Carousel is live on
 * LinkedIn / Facebook Pages / Instagram / Threads (image-only children;
 * compose still rejects mixed image+video). X stays carousel:false (paused
 * billing, out of this pass). YouTube has no carousel concept.
 * TikTok / Pinterest / LinkedIn Company Pages / Reddit have no adapter —
 * treated as unsupported.
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

const TEXT_IMAGE_CAROUSEL: PlatformMediaCaps = {
  text: true,
  image: true,
  video: false,
  carousel: true,
};

/**
 * Documented item bounds for platforms that accept carousel. Checked at
 * schedule time when a media URL count is provided, and again in each
 * adapter. Instagram/Facebook: 2–10; LinkedIn/Threads: 2–20.
 */
export const CAROUSEL_ITEM_LIMITS: Partial<Record<Platform, { min: number; max: number }>> = {
  linkedin_personal: { min: 2, max: 20 },
  facebook: { min: 2, max: 10 },
  instagram: { min: 2, max: 10 },
  threads: { min: 2, max: 20 },
};

/**
 * `null` means no publish adapter exists for that platform. Every in-scope
 * platform with a real adapter has an explicit row.
 */
export const PLATFORM_MEDIA_CAPS: Record<Platform, PlatformMediaCaps | null> = {
  linkedin_personal: TEXT_IMAGE_CAROUSEL,
  facebook: TEXT_IMAGE_CAROUSEL,
  threads: TEXT_IMAGE_CAROUSEL,
  twitter: TEXT_OR_SINGLE_IMAGE,
  instagram: { text: false, image: true, video: true, carousel: true },
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

function carouselCountReason(platform: Platform, mediaUrlCount: number): string | null {
  const limits = CAROUSEL_ITEM_LIMITS[platform];
  if (!limits) return null;
  if (mediaUrlCount >= limits.min && mediaUrlCount <= limits.max) return null;
  return `${PLATFORM_DISPLAY[platform]} carousel posts need between ${limits.min} and ${limits.max} images.`;
}

/**
 * Full rejection sentence, matching (and now owned by) each adapter's
 * `assertSupportedMedia()` message. Null if the combo is allowed.
 */
export function unsupportedMediaReason(
  platform: Platform,
  mediaType: MediaType | null | undefined,
  mediaUrlCount?: number,
): string | null {
  if (isMediaSupportedOnPlatform(platform, mediaType)) {
    if (mediaKindFromType(mediaType) === "carousel" && mediaUrlCount !== undefined) {
      return carouselCountReason(platform, mediaUrlCount);
    }
    return null;
  }

  const caps = PLATFORM_MEDIA_CAPS[platform];
  if (!caps) {
    return `RichFeed can't publish to ${PLATFORM_DISPLAY[platform]} yet.`;
  }

  switch (platform) {
    case "linkedin_personal":
      return "LinkedIn publishing only supports text-only, single-image, or carousel posts right now — video isn't supported yet.";
    case "facebook":
      return "Facebook Page publishing only supports text-only, single-image, or carousel posts right now — video isn't supported yet.";
    case "threads":
      return "Threads publishing only supports text-only, single-image, or carousel posts right now — video isn't supported yet.";
    case "twitter":
      return "X publishing only supports text-only or single-image posts right now — video and carousel aren't supported yet.";
    case "instagram":
      return "Instagram posts need an image, video, or carousel attached — text-only isn't supported.";
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
  mediaUrlCount?: number,
): UnsupportedMediaFailure[] {
  const seen = new Set<Platform>();
  const failures: UnsupportedMediaFailure[] = [];
  for (const platform of platforms) {
    if (seen.has(platform)) continue;
    seen.add(platform);
    const reason = unsupportedMediaReason(platform, mediaType, mediaUrlCount);
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
  mediaUrlCount?: number,
): void {
  const failures = collectUnsupportedMedia(platforms, mediaType, mediaUrlCount);
  if (failures.length > 0) {
    throw new UnsupportedMediaError(failures);
  }
}

/** Null when every platform accepts this media; otherwise the 400 / inline error text. */
export function unsupportedMediaErrorMessage(
  platforms: readonly Platform[],
  mediaType: MediaType | null | undefined,
  mediaUrlCount?: number,
): string | null {
  const failures = collectUnsupportedMedia(platforms, mediaType, mediaUrlCount);
  return failures.length > 0 ? formatUnsupportedMediaError(failures) : null;
}
