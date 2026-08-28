import { PlatformBadge } from "@richfeed/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { QueueRowData } from "../../lib/queue-rows";
import { platformToBadge } from "../../lib/platform";
import { targetStatusToPill } from "../../lib/status";

const TINT_CLASS: Record<ReturnType<typeof targetStatusToPill>, string> = {
  scheduled: "bg-status-scheduled-bg text-status-scheduled-text",
  published: "bg-status-published-bg text-status-published-text",
  failed: "bg-status-failed-bg text-status-failed-text",
  "needs-reconnect": "bg-status-needs-reconnect-bg text-status-needs-reconnect-text",
  queued: "bg-status-queued-bg text-status-queued-text",
};

export function CalendarPostChip({ row }: { row: QueueRowData }): ReactElement {
  const badge = row.account ? platformToBadge(row.account.platform) : null;
  const pill = targetStatusToPill(row.status);

  return (
    <Link
      href={`/posts/${row.postId}`}
      title={row.captionSnippet}
      className={`flex items-center gap-1 truncate rounded-control px-1.5 py-0.5 text-[11px] font-medium ${TINT_CLASS[pill]}`}
    >
      {badge ? (
        <span className="shrink-0 scale-75">
          <PlatformBadge platform={badge} size="sm" />
        </span>
      ) : null}
      <span className="truncate">{row.captionSnippet}</span>
    </Link>
  );
}
