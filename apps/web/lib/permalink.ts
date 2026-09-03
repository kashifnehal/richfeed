import type { PostTargetDto } from "@richfeed/shared";

/**
 * Real public post URL for a published target, or undefined if the
 * platform's adapter didn't return one (not published yet, or the
 * platform genuinely has none — e.g. Threads on a copyright-flagged post).
 * Every adapter (platforms/*.ts) fetches/constructs this server-side at
 * publish time and stores it on post_targets.permalink_url (migration
 * 0005) rather than the frontend guessing a pattern per platform.
 */
export function buildPermalinkUrl(target: PostTargetDto): string | undefined {
  return target.permalinkUrl ?? undefined;
}
