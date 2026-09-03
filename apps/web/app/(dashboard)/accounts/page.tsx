"use client";

import { EmptyState } from "@richfeed/ui";
import { Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { useToast } from "../../../components/shared/Toast";
import { apiFetch } from "../../../lib/api";
import { PLATFORM_LABELS } from "../../../lib/platform";
import { AccountCard } from "./_components/AccountCard";
import { ConnectAccountDialog } from "./_components/ConnectAccountDialog";

const CONNECT_SUCCESS_MESSAGES: Record<string, string> = {
  x: "X account connected.",
  instagram: "Instagram account connected.",
  threads: "Threads account connected.",
};

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  x_state_mismatch: "That connection attempt expired or was tampered with — please try connecting again.",
  x_connect_failed: "Couldn't connect that X account. Please try again.",
  instagram_state_mismatch: "That connection attempt expired or was tampered with — please try connecting again.",
  instagram_connect_failed: "Couldn't connect that Instagram account. Please try again.",
  instagram_personal_account:
    "That's a Personal Instagram account — switch it to a Business or Creator account first, then reconnect.",
  facebook_state_mismatch: "That connection attempt expired or was tampered with — please try connecting again.",
  facebook_connect_failed: "Couldn't connect Facebook. Please try again.",
  facebook_no_pages: "That Facebook account doesn't manage any Pages to connect.",
  threads_state_mismatch: "That connection attempt expired or was tampered with — please try connecting again.",
  threads_connect_failed: "Couldn't connect that Threads account. Please try again.",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccountDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const load = useCallback(() => {
    apiFetch<{ accounts: SocialAccountDto[] }>("/api/accounts")
      .then((res) => setAccounts(res.accounts))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load accounts"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("error");
    if (!connected && !oauthError) return;

    if (connected === "facebook") {
      const count = Number(searchParams.get("count") ?? "0");
      showToast(count === 1 ? "1 Facebook Page connected." : `${count} Facebook Pages connected.`, "success");
    } else if (connected && CONNECT_SUCCESS_MESSAGES[connected]) {
      showToast(CONNECT_SUCCESS_MESSAGES[connected], "success");
    } else if (oauthError) {
      showToast(CONNECT_ERROR_MESSAGES[oauthError] ?? "Couldn't connect that account. Please try again.", "error");
    }

    router.replace("/accounts");
  }, [searchParams, router, showToast]);

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
