import { EmptyState, PlatformBadge, StatusPill } from "@richfeed/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { PostTargetDto } from "@richfeed/shared";
import { platformToBadge } from "../../../../lib/platform";
import { targetStatusToPill } from "../../../../lib/status";

export interface UpcomingPreviewProps {
  targets: PostTargetDto[];
}

export function UpcomingPreview({ targets }: UpcomingPreviewProps): ReactElement {
  if (targets.length === 0) {
    return (
      <EmptyState
        title="Nothing scheduled yet"
        description="Posts you schedule will show up here, soonest first."
      />
    );
  }

  return (
    <div className="flex flex-col divide-y divide-subtle-2 rounded-card border border-subtle-2 bg-surface">
      {targets.map((target) => {
        const badge = target.account ? platformToBadge(target.account.platform) : null;
        return (
          <Link
            key={target.id}
            href={`/posts/${target.scheduledPostId}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sidebar-hover"
          >
            {badge ? <PlatformBadge platform={badge} /> : null}
            <span className="flex-1 truncate text-sm text-primary">
              {target.account?.displayName ?? target.account?.platform ?? "Account"}
            </span>
            <span className="whitespace-nowrap text-xs text-secondary">
              {new Date(target.publishAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <StatusPill status={targetStatusToPill(target.status)} />
          </Link>
        );
      })}
    </div>
  );
}
