"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Avatar, StatusPill } from "@richfeed/ui";
import { MoreVertical } from "lucide-react";
import { useState, type ReactElement } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { ConfirmDialog } from "../../../../components/shared/ConfirmDialog";
import { useToast } from "../../../../components/shared/Toast";
import { accountStatusLabel, accountStatusToPill } from "../../../../lib/account-status";
import { ApiError, apiFetch } from "../../../../lib/api";
import { PLATFORM_LABELS, platformToBadge } from "../../../../lib/platform";

export interface AccountCardProps {
  account: SocialAccountDto;
  onChanged: () => void;
}

export function AccountCard({ account, onChanged }: AccountCardProps): ReactElement {
  const { showToast } = useToast();
  const [confirmAction, setConfirmAction] = useState<"disconnect" | "remove" | null>(null);
  const badge = platformToBadge(account.platform);
  const isDisconnected = account.status === "disconnected";

  async function handleDisconnect() {
    try {
      await apiFetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "disconnect" }),
      });
      showToast("Account disconnected.", "success");
      onChanged();
    } catch {
      showToast("Couldn't disconnect this account. Try again.", "error");
    }
  }

  async function handleRemove() {
    try {
      await apiFetch(`/api/accounts/${account.id}`, { method: "DELETE" });
      showToast("Account removed.", "success");
      onChanged();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't remove this account. Try again.";
      showToast(message, "error");
    }
  }

  function handleReconnect() {
    showToast("Not yet connected — coming in the next build.", "info");
  }

  return (
    <div className="flex items-center gap-3 rounded-card border border-subtle-2 bg-surface p-4">
      <Avatar name={account.displayName ?? account.platform} imageUrl={account.avatarUrl} platform={badge} />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-primary">
          {account.displayName ?? PLATFORM_LABELS[account.platform]}
        </span>
        <span className="text-xs text-secondary">{PLATFORM_LABELS[account.platform]}</span>
        <div className="mt-1.5">
          <StatusPill
            status={accountStatusToPill(account.status)}
            label={accountStatusLabel(account.status)}
          />
        </div>
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Account actions"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-secondary transition-colors hover:bg-sidebar-hover hover:text-primary"
          >
            <MoreVertical size={18} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 w-44 rounded-card border border-subtle-2 bg-surface p-1.5 shadow-lg"
          >
            <DropdownMenu.Item
              onSelect={handleReconnect}
              className="cursor-pointer rounded-control px-2.5 py-2 text-sm text-primary outline-none transition-colors hover:bg-sidebar-hover"
            >
              Reconnect
            </DropdownMenu.Item>
            {isDisconnected ? (
              <DropdownMenu.Item
                onSelect={() => setConfirmAction("remove")}
                className="cursor-pointer rounded-control px-2.5 py-2 text-sm text-primary outline-none transition-colors hover:bg-sidebar-hover"
              >
                Remove permanently
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                onSelect={() => setConfirmAction("disconnect")}
                className="cursor-pointer rounded-control px-2.5 py-2 text-sm text-primary outline-none transition-colors hover:bg-sidebar-hover"
              >
                Disconnect
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {isDisconnected ? (
        <ConfirmDialog
          open={confirmAction === "remove"}
          onOpenChange={(open) => setConfirmAction(open ? "remove" : null)}
          title="Remove this account permanently?"
          description={`This deletes ${account.displayName ?? PLATFORM_LABELS[account.platform]} from RichFeed for good. Blocked while any scheduled or published posts still reference it.`}
          confirmLabel="Remove permanently"
          onConfirm={() => void handleRemove()}
        />
      ) : (
        <ConfirmDialog
          open={confirmAction === "disconnect"}
          onOpenChange={(open) => setConfirmAction(open ? "disconnect" : null)}
          title="Disconnect this account?"
          description={`RichFeed will stop publishing to ${account.displayName ?? PLATFORM_LABELS[account.platform]}. Its post history stays intact and you can reconnect it later.`}
          confirmLabel="Disconnect"
          onConfirm={() => void handleDisconnect()}
        />
      )}
    </div>
  );
}
