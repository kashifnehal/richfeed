import Link from "next/link";
import type { ReactElement } from "react";
import type { DashboardStats } from "../../../../lib/dashboard-types";

export interface StatusSummaryRowProps {
  stats: DashboardStats;
}

interface Tile {
  label: string;
  value: number;
  href?: string;
  emphasis?: "failed" | "reconnect";
}

const EMPHASIS_CLASS: Record<NonNullable<Tile["emphasis"]>, string> = {
  failed: "bg-status-failed-bg text-status-failed-text",
  reconnect: "bg-status-needs-reconnect-bg text-status-needs-reconnect-text",
};

export function StatusSummaryRow({ stats }: StatusSummaryRowProps): ReactElement {
  const tiles: Tile[] = [
    { label: "Scheduled this week", value: stats.scheduledThisWeek },
    { label: "Published (7d)", value: stats.publishedLast7Days },
    {
      label: "Failed — needs attention",
      value: stats.failedCount,
      href: "/queue?status=failed",
      emphasis: "failed",
    },
    {
      label: "Accounts needing reconnect",
      value: stats.accountsNeedingReconnect,
      href: "/accounts",
      emphasis: "reconnect",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => {
        const content = (
          <div
            className={`flex flex-col gap-2 rounded-card border border-subtle-2 p-5 transition-shadow ${
              tile.emphasis ? EMPHASIS_CLASS[tile.emphasis] : "bg-surface"
            } ${tile.href ? "hover:shadow-sm" : ""}`}
          >
            <span className="text-3xl font-bold">{tile.value}</span>
            <span className="text-sm font-medium opacity-90">{tile.label}</span>
          </div>
        );

        return tile.href ? (
          <Link key={tile.label} href={tile.href}>
            {content}
          </Link>
        ) : (
          <div key={tile.label}>{content}</div>
        );
      })}
    </div>
  );
}
