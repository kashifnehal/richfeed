import type { AccountStatus } from "@richfeed/shared";
import type { StatusPillStatus } from "@richfeed/ui";

/**
 * AccountStatus -> StatusPillStatus. There's no dedicated "connected"/
 * "limited" pill color in the design system, so these reuse the closest
 * existing status colors (published = healthy, scheduled = degraded-but-
 * working) with a label override rather than introducing new hex values.
 */
const PILL_MAP: Record<AccountStatus, StatusPillStatus> = {
  connected: "published",
  needs_reconnect: "needs-reconnect",
  limited: "scheduled",
};

const LABEL_MAP: Record<AccountStatus, string> = {
  connected: "Connected",
  needs_reconnect: "Needs reconnect",
  limited: "Limited",
};

export function accountStatusToPill(status: AccountStatus): StatusPillStatus {
  return PILL_MAP[status];
}

export function accountStatusLabel(status: AccountStatus): string {
  return LABEL_MAP[status];
}
