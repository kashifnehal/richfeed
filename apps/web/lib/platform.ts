import type { Platform } from "@richfeed/shared";
import type { PlatformBadgePlatform } from "@richfeed/ui";

/**
 * Platform -> PlatformBadge mapping. PlatformBadge (packages/ui) only has
 * brand colors/monograms for the 6 platforms in tokens.css — these are the
 * "Tier 1" platforms RichFeed rolls out first. Platforms without a token
 * color (pinterest, threads, reddit) return null and render as a plain
 * "Coming soon" tile instead, per the Accounts page spec.
 */
const BADGE_MAP: Partial<Record<Platform, PlatformBadgePlatform>> = {
  instagram: "instagram",
  facebook: "facebook",
  twitter: "x",
  linkedin_personal: "linkedin",
  linkedin_org: "linkedin",
  youtube: "youtube",
  tiktok: "tiktok",
};

export function platformToBadge(platform: Platform): PlatformBadgePlatform | null {
  return BADGE_MAP[platform] ?? null;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  linkedin_personal: "LinkedIn (Personal)",
  linkedin_org: "LinkedIn (Company Page)",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  threads: "Threads",
  reddit: "Reddit",
};

/** Platforms available to connect now vs. shown grayed out as "Coming soon". */
export const ENABLED_PLATFORMS: Platform[] = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin_personal",
  "linkedin_org",
  "youtube",
  "tiktok",
];

export const COMING_SOON_PLATFORMS: Platform[] = ["pinterest", "threads", "reddit"];

export const ALL_PLATFORMS: Platform[] = [...ENABLED_PLATFORMS, ...COMING_SOON_PLATFORMS];
