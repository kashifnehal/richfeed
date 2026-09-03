"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Avatar, EmptyState } from "@richfeed/ui";
import { Copy, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactElement, type ReactNode } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { ScheduleTimePicker } from "./ScheduleTimePicker";
import { accountStatusLabel } from "../../lib/account-status";
import { PLATFORM_LABELS, platformToBadge } from "../../lib/platform";

export interface DuplicateDialogProps {
  accounts: SocialAccountDto[];
  onDuplicate: (accountId: string, publishAt: string) => Promise<void>;
  /** Custom trigger (e.g. a compact icon button for a table row). Defaults to a full-width labeled button. */
  trigger?: ReactNode;
}

function defaultPublishAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d.toISOString();
}

export function DuplicateDialog({ accounts, onDuplicate, trigger }: DuplicateDialogProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [publishAt, setPublishAt] = useState(defaultPublishAt());
  const [submitting, setSubmitting] = useState(false);

  // Disconnected accounts can't be posted to at all — excluded entirely,
  // unlike needs_reconnect which stays selectable-but-flagged below.
  const selectableAccounts = accounts.filter((a) => a.status !== "disconnected");

  async function handleConfirm() {
    if (!accountId) return;
    setSubmitting(true);
    try {
      await onDuplicate(accountId, publishAt);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-control border border-subtle px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-sidebar-hover"
          >
            <Copy size={15} />
            Duplicate to another account
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ backgroundColor: "var(--sq-text-primary)", opacity: 0.35 }}
          className="fixed inset-0 z-40"
        />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-subtle-2 bg-surface p-6 shadow-lg focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-primary">
              Duplicate to another account
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-control text-secondary hover:bg-sidebar-hover hover:text-primary"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {selectableAccounts.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No connected accounts"
                description="Connect an account first to duplicate this post to it."
                action={
                  <Link
                    href="/accounts"
                    className="rounded-control bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
                  >
                    Go to Accounts
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-1.5">
                {selectableAccounts.map((account) => {
                  const disabled = account.status === "needs_reconnect";
                  return (
                    <label
                      key={account.id}
                      title={disabled ? "Reconnect this account before duplicating a post to it." : undefined}
                      className={`flex items-center gap-3 rounded-control border border-subtle-2 px-3 py-2.5 transition-colors ${
                        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-sidebar-hover"
                      }`}
                    >
                      <input
                        type="radio"
                        name="duplicate-target"
                        checked={accountId === account.id}
                        disabled={disabled}
                        onChange={() => setAccountId(account.id)}
                        className="h-4 w-4 accent-[color:var(--sq-accent)]"
                      />
                      <Avatar
                        name={account.displayName ?? account.platform}
                        imageUrl={account.avatarUrl}
                        platform={platformToBadge(account.platform)}
                        size="sm"
                      />
                      <span className="flex flex-1 flex-col">
                        <span className="text-sm text-primary">
                          {account.displayName ?? PLATFORM_LABELS[account.platform]}
                        </span>
                        {disabled ? (
                          <span className="text-xs text-status-needs-reconnect-text">
                            {accountStatusLabel(account.status)}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4">
                <ScheduleTimePicker value={publishAt} onChange={setPublishAt} />
              </div>

              <button
                type="button"
                disabled={!accountId || submitting}
                onClick={() => void handleConfirm()}
                className="mt-5 w-full rounded-control bg-accent px-3.5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {submitting ? "Duplicating..." : "Duplicate"}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
