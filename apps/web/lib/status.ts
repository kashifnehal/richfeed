import type { PostTargetStatus } from "@richfeed/shared";
import type { StatusPillStatus } from "@richfeed/ui";

/**
 * PostTargetStatus (DB / 6 values) -> StatusPillStatus, minus "disconnected"
 * (an account-only status a post target can never have). "publishing" has no
 * dedicated pill color, so it's shown as "queued" — visually "in flight",
 * which is the closest accurate meaning.
 */
type TargetPillStatus = Exclude<StatusPillStatus, "disconnected">;

const PILL_MAP: Record<PostTargetStatus, TargetPillStatus> = {
  pending: "scheduled",
  queued: "queued",
  publishing: "queued",
  published: "published",
  failed: "failed",
  needs_reconnect: "needs-reconnect",
};

export function targetStatusToPill(status: PostTargetStatus): TargetPillStatus {
  return PILL_MAP[status];
}

const LABEL_MAP: Record<PostTargetStatus, string> = {
  pending: "Scheduled",
  queued: "Queued",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  needs_reconnect: "Needs reconnect",
};

export function targetStatusLabel(status: PostTargetStatus): string {
  return LABEL_MAP[status];
}
