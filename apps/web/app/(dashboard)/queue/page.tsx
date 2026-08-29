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

interface PostsPage {
  posts: ScheduledPostDto[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

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
  // Server-side "load more" pagination: GET /api/posts?limit&offset&sort pages
  // the queue at the post_targets (row) level. `total`/`serverHasMore` come
  // straight from the API's `pagination` block; `nextOffset` is the row offset
  // for the next page. Page size of 20 is a product-decision placeholder.
  const PAGE_SIZE = 20;
  const [total, setTotal] = useState(0);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (statuses.length > 0) params.set("status", statuses.join(","));
      if (platforms.length > 0) params.set("platform", platforms.join(","));
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      params.set("sort", sortDir);
      return apiFetch<PostsPage>(`/api/posts?${params.toString()}`);
    },
    [statuses, platforms, sortDir],
  );

  /** Merge a fresh page of posts into the accumulated set, deduping targets by id. */
  function mergePosts(prev: ScheduledPostDto[], incoming: ScheduledPostDto[]): ScheduledPostDto[] {
    const map = new Map(prev.map((p) => [p.id, { ...p, targets: [...p.targets] }]));
    for (const post of incoming) {
      const existing = map.get(post.id);
      if (!existing) {
        map.set(post.id, { ...post, targets: [...post.targets] });
        continue;
      }
      const seen = new Set(existing.targets.map((t) => t.id));
      existing.targets.push(...post.targets.filter((t) => !seen.has(t.id)));
    }
    return [...map.values()];
  }

  // (Re)load page 1 whenever the status filter or sort direction changes.
  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    setNextOffset(PAGE_SIZE);
    fetchPage(0)
      .then((res) => {
        if (cancelled) return;
        setPosts(res.posts);
        setTotal(res.pagination.total);
        setServerHasMore(res.pagination.hasMore);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  useEffect(() => {
    apiFetch<{ accounts: SocialAccountDto[] }>("/api/accounts")
      .then((res) => setAccounts(res.accounts))
      .catch(() => setAccounts([]));
  }, []);

  const load = useCallback(() => {
    setPosts(null);
    setNextOffset(PAGE_SIZE);
    fetchPage(0)
      .then((res) => {
        setPosts(res.posts);
        setTotal(res.pagination.total);
        setServerHasMore(res.pagination.hasMore);
      })
      .catch(() => setPosts([]));
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetchPage(nextOffset);
      setPosts((prev) => mergePosts(prev ?? [], res.posts));
      setTotal(res.pagination.total);
      setServerHasMore(res.pagination.hasMore);
      setNextOffset((o) => o + PAGE_SIZE);
    } catch {
      showToast("Couldn't load more of the queue. Try again.", "error");
    } finally {
      setLoadingMore(false);
    }
  }

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

  // Platform + status filtering is now fully server-side (GET /api/posts
  // ?platform&status), so every loaded row is already a match and the "N
  // remaining" count below is exact.
  const allRows = flattenToQueueRows(posts ?? []);
  const rows = useMemo(() => {
    const next = [...allRows];
    if (sortDir === "desc") next.reverse(); // flattenToQueueRows is already soonest-first (asc)
    return next;
  }, [allRows, sortDir]);
  const hasMore = serverHasMore;
  const remaining = Math.max(0, total - allRows.length);

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
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="self-center rounded-control border border-subtle bg-surface px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-sidebar-hover disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : `Load more (${remaining} remaining)`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
