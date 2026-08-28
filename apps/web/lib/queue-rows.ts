import type { Platform, PostTargetStatus, ScheduledPostDto, SocialAccountDto } from "@richfeed/shared";

export interface QueueRowData {
  targetId: string;
  postId: string;
  thumbnail: string | null;
  captionSnippet: string;
  account: SocialAccountDto | null;
  publishAt: string;
  status: PostTargetStatus;
}

/** Flattens posts-with-targets into one row per target, sorted soonest-first. */
export function flattenToQueueRows(
  posts: ScheduledPostDto[],
  platformFilter: Platform[] = [],
): QueueRowData[] {
  const rows: QueueRowData[] = [];

  for (const post of posts) {
    for (const target of post.targets) {
      if (platformFilter.length > 0 && (!target.account || !platformFilter.includes(target.account.platform))) {
        continue;
      }
      rows.push({
        targetId: target.id,
        postId: post.id,
        thumbnail: post.mediaUrls?.[0] ?? null,
        captionSnippet: post.caption ?? "(No caption)",
        account: target.account,
        publishAt: target.publishAt,
        status: target.status,
      });
    }
  }

  return rows.sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime());
}
