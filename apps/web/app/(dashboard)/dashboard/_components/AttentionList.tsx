import { PlatformBadge } from "@richfeed/ui";
import { AlertTriangle, Link2Off } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import type { PostTargetDto, SocialAccountDto } from "@richfeed/shared";
import { EmptyState } from "@richfeed/ui";
import { platformToBadge } from "../../../../lib/platform";

export interface AttentionListProps {
  failedTargets: PostTargetDto[];
  accountsNeedingReconnect: SocialAccountDto[];
}

export function AttentionList({
  failedTargets,
  accountsNeedingReconnect,
}: AttentionListProps): ReactElement {
  const rows = [
    ...failedTargets.map((t) => ({
      id: `failed-${t.id}`,
      href: `/posts/${t.scheduledPostId}`,
      title: t.status === "needs_reconnect" ? "Target needs account reconnect" : "Post failed to publish",
      subtitle: t.account?.displayName ?? t.account?.platform ?? "Unknown account",
      platform: t.account?.platform,
      icon:
        t.status === "needs_reconnect" ? (
          <Link2Off size={16} className="text-status-needs-reconnect-text" />
        ) : (
          <AlertTriangle size={16} className="text-status-failed-text" />
        ),
    })),
    ...accountsNeedingReconnect.map((a) => ({
      id: `reconnect-${a.id}`,
      href: "/accounts",
      title: "Account needs reconnect",
      subtitle: a.displayName ?? a.platform,
      platform: a.platform,
      icon: <Link2Off size={16} className="text-status-needs-reconnect-text" />,
    })),
  ];

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing needs your attention"
        description="Failed posts and accounts that need reconnecting will show up here."
      />
    );
  }

  return (
    <div className="flex flex-col divide-y divide-subtle-2 rounded-card border border-subtle-2 bg-surface">
      {rows.map((row) => {
        const badge = row.platform ? platformToBadge(row.platform) : null;
        return (
          <Link
            key={row.id}
            href={row.href}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sidebar-hover"
          >
            {badge ? <PlatformBadge platform={badge} /> : row.icon}
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-primary">{row.title}</span>
              <span className="text-xs text-secondary">{row.subtitle}</span>
            </div>
            {row.icon}
          </Link>
        );
      })}
    </div>
  );
}
