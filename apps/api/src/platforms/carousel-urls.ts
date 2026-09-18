import { CAROUSEL_ITEM_LIMITS, type Platform } from "@richfeed/shared";
import { PlatformPublishError, type PublishPost } from "./types";

/**
 * Carousel posts are 2+ images (compose rejects mixed image+video). Adapters
 * call this after `assertSupportedMedia` so a too-short / too-long URL list
 * fails with the same sentence the schedule-time 400 uses.
 */
export function requireCarouselImageUrls(platform: Platform, post: PublishPost): string[] {
  const limits = CAROUSEL_ITEM_LIMITS[platform];
  const urls = (post.mediaUrls ?? []).filter((url) => url.length > 0);
  if (!limits || urls.length < limits.min || urls.length > limits.max) {
    const label =
      platform === "linkedin_personal"
        ? "LinkedIn"
        : platform === "facebook"
          ? "Facebook Page"
          : platform === "instagram"
            ? "Instagram"
            : "Threads";
    const min = limits?.min ?? 2;
    const max = limits?.max ?? 10;
    throw new PlatformPublishError(
      `${label} carousel posts need between ${min} and ${max} images.`,
      false,
    );
  }
  return urls;
}
