"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AlertTriangle, Bell, Link2Off } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";
import { apiFetch } from "../../lib/api";

interface NotificationItem {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  kind: "failed" | "needs_reconnect";
}

interface DashboardResponse {
  attention: {
    failedTargets: {
      id: string;
      scheduledPostId: string;
      status: string;
      account: { displayName: string | null; platform: string } | null;
    }[];
    accountsNeedingReconnect: { id: string; displayName: string | null; platform: string }[];
  };
}

/** Bell with a red-dot badge when unread items exist; dropdown lists failed posts + needs-reconnect accounts. */
export function NotificationBell(): ReactElement {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<DashboardResponse>("/api/dashboard");
      const failed: NotificationItem[] = data.attention.failedTargets.map((t) => ({
        id: `failed-${t.id}`,
        label: t.status === "needs_reconnect" ? "Target needs account reconnect" : "Post failed to publish",
        sublabel: t.account?.displayName ?? t.account?.platform ?? "Unknown account",
        href: `/posts/${t.scheduledPostId}`,
        kind: t.status === "needs_reconnect" ? "needs_reconnect" : "failed",
      }));
      const reconnect: NotificationItem[] = data.attention.accountsNeedingReconnect.map((a) => ({
        id: `reconnect-${a.id}`,
        label: "Account needs reconnect",
        sublabel: a.displayName ?? a.platform,
        href: "/accounts",
        kind: "needs_reconnect",
      }));
      setItems([...failed, ...reconnect]);
    } catch {
      // Non-fatal — the bell just shows no unread items if the fetch fails.
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const hasUnread = loaded && items.length > 0;

  return (
    <DropdownMenu.Root onOpenChange={(open) => open && void load()}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-control text-nav-inactive transition-colors hover:bg-sidebar-hover hover:text-primary"
        >
          <Bell size={20} strokeWidth={1.75} />
          {hasUnread ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-pill bg-status-failed-text" />
          ) : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-card border border-subtle-2 bg-surface p-2 shadow-lg"
        >
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-secondary">
            Notifications
          </p>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-secondary">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <DropdownMenu.Item key={item.id} asChild>
                  <Link
                    href={item.href}
                    className="flex items-start gap-2.5 rounded-control px-2 py-2 text-sm outline-none transition-colors hover:bg-sidebar-hover"
                  >
                    <span
                      className={
                        item.kind === "failed"
                          ? "mt-0.5 text-status-failed-text"
                          : "mt-0.5 text-status-needs-reconnect-text"
                      }
                    >
                      {item.kind === "failed" ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <Link2Off size={16} />
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium text-primary">{item.label}</span>
                      <span className="text-xs text-secondary">{item.sublabel}</span>
                    </span>
                  </Link>
                </DropdownMenu.Item>
              ))}
            </ul>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
