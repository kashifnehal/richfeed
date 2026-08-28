"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import type { DashboardResponse } from "../../../lib/dashboard-types";
import { AttentionList } from "./_components/AttentionList";
import { StatusSummaryRow } from "./_components/StatusSummaryRow";
import { UpcomingPreview } from "./_components/UpcomingPreview";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<DashboardResponse>("/api/dashboard")
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-status-failed-text">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-secondary">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <StatusSummaryRow stats={data.stats} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Needs your attention
        </h2>
        <AttentionList
          failedTargets={data.attention.failedTargets}
          accountsNeedingReconnect={data.attention.accountsNeedingReconnect}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Coming up next
        </h2>
        <UpcomingPreview targets={data.upcoming} />
      </section>
    </div>
  );
}
