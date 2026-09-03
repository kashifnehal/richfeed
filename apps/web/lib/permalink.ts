import type { Platform, SocialAccountDto } from "@richfeed/shared";

/**
 * Real public post URL for a published target, or undefined for a platform
 * that doesn't have one wired up yet — callers use that to keep the
 * permalink icon inert instead of rendering a dead link.
 */
export function buildPermalinkUrl(
  platform: Platform,
  platformPostId: string,
  account: SocialAccountDto | null,
): string | undefined {
  if (platform === "twitter" && account?.platformUsername) {
    return `https://x.com/${account.platformUsername}/status/${platformPostId}`;
  }
  return undefined;
}
