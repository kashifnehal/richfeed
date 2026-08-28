"use client";

import { EmptyState, PlatformBadge, StatusPill } from "@richfeed/ui";
import { ArrowDown, ArrowUp, ListChecks } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Platform, PostTargetStatus, ScheduledPostDto, SocialAccountDto } from "@richfeed/shared";
import { FilterBar } from "../../../components/post/FilterBar";
import { useToast } from "../../../components/shared/Toast";
import { apiFetch } from "../../../lib/api";
import { PLATFORM_LABELS, platformToBadge } from "../../../lib/platform";
import { flattenToQueueRows } from "../../../lib/queue-rows";
import { targetStatusLabel, targetStatusToPill } from "../../../lib/status";
import { QueueRowActions } from "./_components/QueueRowActions";

export default function QueuePage() {
  return (
    <Suspense fallback={<p className="text-sm text-secondary">Loading...</p>}>
      <QueueContent />
    </Suspense>
  );
}

function QueueContent() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [statuses, setStatuses] = useState<PostTargetStatus[]>(() => {
    const initial = searchParams.get("status");
    return initial ? [initial as PostTargetStatus] : [];
  });
  const [posts, setPosts] = useState<ScheduledPostDto[] | null>(null);
  const [accounts, setAccounts] = useState<SocialAccountDto[]>([]);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // Client-side "load more" pagination — the API has no offset/limit yet,
  // but the queue can realistically hold far more rows than fit one screen,
  // so this at least keeps the initial render/scroll manageable. Page size
  // of 20 is a product-decision placeholder, not a backend constraint.
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(() => {
    const query = statuses.length > 0 ? `?status=${statuses.join(",")}` : "";
    apiFetch<{ posts: ScheduledPostDto[] }>(`/api/posts${query}`)
      .then((res) => setPosts(res.posts))
      .catch(() => setPosts([]));
    apiFetch<{ accounts: SocialAccountDto[] }>("/api/accounts")
      .then((res) => setAccounts(res.accounts))
      .catch(() => setAccounts([]));
  }, [statuses]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(targetId: string) {
    const row = rows.find((r) => r.targetId === targetId);
    if (!row) return;
    try {
      await apiFetch(`/api/posts/${row.postId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel", targetId }),
      });
      showToast("Target canceled.", "success");
      load();
    } catch {
      showToast("Couldn't cancel this target. Try again.", "error");
    }
  }

  async function handleDuplicate(postId: string, accountId: string, publishAt: string) {
    try {
      await apiFetch(`/api/posts/${postId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ socialAccountId: accountId, publishAt }),
      });
      showToast("Post duplicated.", "success");
      load();
    } catch {
      showToast("Couldn't duplicate this post. Try again.", "error");
    }
  }

  const allRows = flattenToQueueRows(posts ?? [], platforms);
  const sortedRows = useMemo(() => {
    const next = [...allRows];
    if (sortDir === "desc") next.reverse(); // flattenToQueueRows is already soonest-first (asc)
    return next;
  }, [allRows, sortDir]);
  const rows = sortedRows.slice(0, visibleCount);
  const hasMore = sortedRows.length > rows.length;

  // Reset pagination whenever the underlying row set changes shape, so
  // switching filters doesn't leave you stranded on page 3 of a now-shorter list.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statuses, platforms, sortDir]);

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        platforms={platforms}
        onPlatformsChange={setPlatforms}
        statuses={statuses}
        onStatusesChange={setStatuses}
      />

      {posts === null ? (
        <p className="text-sm text-secondary">Loading...</p>
      ) : allRows.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={22} />}
          title="Nothing in the queue"
          description="Posts you schedule will show up here, ordered by publish time."
        />
      ) : (
        <>
          {/* Table, sm and up */}
          <div className="hidden overflow-x-auto rounded-card border border-subtle-2 bg-surface sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-subtle-2 text-xs uppercase tracking-wide text-secondary">
                  <th className="px-4 py-3 font-semibold">Post</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                      className="flex items-center gap-1 font-semibold text-secondary transition-colors hover:text-primary"
                    >
                      Scheduled
                      {sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle-2">
                {rows.map((row) => {
                  const badge = row.account ? platformToBadge(row.account.platform) : null;
                  return (
                    <tr key={row.targetId}>
                      <td className="max-w-xs px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {row.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail, table cell
                            <img
                              src={row.thumbnail}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-control object-cover"
                            />
                          ) : null}
                          <span className="truncate text-primary">{row.captionSnippet}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-secondary">
                          {badge ? <PlatformBadge platform={badge} /> : null}
                          <span className="truncate">
                            {row.account?.displayName ??
                              (row.account ? PLATFORM_LABELS[row.account.platform] : "—")}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-secondary">
                        {new Date(row.publishAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={targetStatusToPill(row.status)} label={targetStatusLabel(row.status)} />
                      </td>
                      <td className="px-4 py-3">
                        <QueueRowActions
                          row={row}
                          accounts={accounts}
                          onCancel={handleCancel}
                          onDuplicate={handleDuplicate}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stacked cards, below sm */}
          <div className="flex flex-col gap-3 sm:hidden">
            {rows.map((row) => {
              const badge = row.account ? platformToBadge(row.account.platform) : null;
              return (
                <div key={row.targetId} className="rounded-card border border-subtle-2 bg-surface p-4">
                  <div className="flex items-start gap-2.5">
                    {row.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail, card layout
                      <img src={row.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-control object-cover" />
                    ) : null}
                    <div className="flex-1">
                      <p className="line-clamp-2 text-sm text-primary">{row.captionSnippet}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-secondary">
                        {badge ? <PlatformBadge platform={badge} size="sm" /> : null}
                        {row.account?.displayName ?? (row.account ? PLATFORM_LABELS[row.account.platform] : "—")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <StatusPill status={targetStatusToPill(row.status)} label={targetStatusLabel(row.status)} />
                      <span className="text-xs text-secondary">
                        {new Date(row.publishAt).toLocaleString()}
                      </span>
                    </div>
                    <QueueRowActions
                      row={row}
                      accounts={accounts}
                      onCancel={handleCancel}
                      onDuplicate={handleDuplicate}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="self-center rounded-control border border-subtle bg-surface px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-sidebar-hover"
            >
              Load more ({sortedRows.length - rows.length} remaining)
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
