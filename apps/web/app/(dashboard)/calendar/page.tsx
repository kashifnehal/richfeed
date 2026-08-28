"use client";

import { EmptyState } from "@richfeed/ui";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Platform, PostTargetStatus, ScheduledPostDto } from "@richfeed/shared";
import { CalendarPostChip } from "../../../components/post/CalendarPostChip";
import { FilterBar } from "../../../components/post/FilterBar";
import { apiFetch } from "../../../lib/api";
import { dateKey, getMonthGridDays, getWeekDays, isSameDay, isSameMonth } from "../../../lib/calendar";
import { flattenToQueueRows, type QueueRowData } from "../../../lib/queue-rows";

type ViewMode = "month" | "week";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [statuses, setStatuses] = useState<PostTargetStatus[]>([]);
  const [posts, setPosts] = useState<ScheduledPostDto[] | null>(null);

  const days = useMemo(
    () => (viewMode === "month" ? getMonthGridDays(anchor) : getWeekDays(anchor)),
    [viewMode, anchor],
  );
  const rangeStart = days[0]!;
  const rangeEnd = days[days.length - 1]!;

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("from", new Date(rangeStart).toISOString());
    const endOfRange = new Date(rangeEnd);
    endOfRange.setHours(23, 59, 59, 999);
    params.set("to", endOfRange.toISOString());
    if (statuses.length > 0) params.set("status", statuses.join(","));

    apiFetch<{ posts: ScheduledPostDto[] }>(`/api/posts?${params.toString()}`)
      .then((res) => setPosts(res.posts))
      .catch(() => setPosts([]));
  }, [days, statuses]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = flattenToQueueRows(posts ?? [], platforms);
  const rowsByDate = new Map<string, QueueRowData[]>();
  for (const row of rows) {
    const key = dateKey(new Date(row.publishAt));
    rowsByDate.set(key, [...(rowsByDate.get(key) ?? []), row]);
  }

  function shiftAnchor(amount: number) {
    const next = new Date(anchor);
    if (viewMode === "month") next.setMonth(next.getMonth() + amount);
    else next.setDate(next.getDate() + amount * 7);
    setAnchor(next);
  }

  const today = new Date();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => shiftAnchor(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-control text-secondary hover:bg-sidebar-hover hover:text-primary"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => shiftAnchor(1)}
              className="flex h-8 w-8 items-center justify-center rounded-control text-secondary hover:bg-sidebar-hover hover:text-primary"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <h2 className="text-sm font-semibold text-primary">
            {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
        </div>

        <div className="flex items-center gap-1 rounded-control border border-subtle bg-surface p-1">
          {(["month", "week"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-control px-3 py-1 text-sm font-medium capitalize transition-colors ${
                viewMode === mode ? "bg-accent text-on-accent" : "text-secondary hover:text-primary"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <FilterBar
        platforms={platforms}
        onPlatformsChange={setPlatforms}
        statuses={statuses}
        onStatusesChange={setStatuses}
      />

      {posts !== null && rows.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="Nothing scheduled in this range"
          description="Posts you schedule will appear here on their publish date."
        />
      ) : (
        <>
          {/* Grid, md and up */}
          <div className="hidden md:block">
            <div
              className={`grid gap-px overflow-hidden rounded-card border border-subtle-2 bg-subtle-2 ${
                viewMode === "month" ? "grid-cols-7" : "grid-cols-7"
              }`}
            >
              {days.slice(0, 7).map((d) => (
                <div
                  key={`h-${d.getDay()}`}
                  className="bg-surface px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-secondary"
                >
                  {WEEKDAY_LABELS[d.getDay()]}
                </div>
              ))}
              {days.map((day) => {
                const key = dateKey(day);
                const dayRows = rowsByDate.get(key) ?? [];
                const dimmed = viewMode === "month" && !isSameMonth(day, anchor);
                return (
                  <div
                    key={key}
                    className={`flex min-h-[110px] flex-col gap-1 bg-surface p-1.5 ${dimmed ? "opacity-40" : ""}`}
                  >
                    <span
                      className={`self-start text-xs font-semibold ${
                        isSameDay(day, today) ? "rounded-pill bg-accent px-1.5 text-on-accent" : "text-secondary"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex flex-col gap-1 overflow-y-auto">
                      {dayRows.map((row) => (
                        <CalendarPostChip key={row.targetId} row={row} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agenda list, below md */}
          <div className="flex flex-col gap-4 md:hidden">
            {Array.from(rowsByDate.entries()).map(([key, dayRows]) => (
              <div key={key} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {new Date(key).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {dayRows.map((row) => (
                    <div key={row.targetId} className="rounded-control border border-subtle-2 bg-surface p-2">
                      <CalendarPostChip row={row} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
