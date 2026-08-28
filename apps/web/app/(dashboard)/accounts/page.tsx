"use client";

import { EmptyState } from "@richfeed/ui";
import { Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { apiFetch } from "../../../lib/api";
import { PLATFORM_LABELS } from "../../../lib/platform";
import { AccountCard } from "./_components/AccountCard";
import { ConnectAccountDialog } from "./_components/ConnectAccountDialog";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccountDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<{ accounts: SocialAccountDto[] }>("/api/accounts")
      .then((res) => setAccounts(res.accounts))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load accounts"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = new Map<string, SocialAccountDto[]>();
  for (const account of accounts ?? []) {
    const label = PLATFORM_LABELS[account.platform];
    groups.set(label, [...(groups.get(label) ?? []), account]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-sm text-secondary">
          Connect the social accounts you want to schedule posts to.
        </p>
        <ConnectAccountDialog />
      </div>

      {error ? <p className="text-sm text-status-failed-text">{error}</p> : null}

      {!accounts ? (
        <p className="text-sm text-secondary">Loading...</p>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No accounts connected yet"
          description="Connect an account to start scheduling posts to it."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groups.entries()).map(([platformLabel, group]) => (
            <section key={platformLabel} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {platformLabel}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {group.map((account) => (
                  <AccountCard key={account.id} account={account} onChanged={load} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
