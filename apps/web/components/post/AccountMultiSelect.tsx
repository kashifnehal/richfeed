import { Avatar, EmptyState } from "@richfeed/ui";
import { Users } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { PLATFORM_LABELS, platformToBadge } from "../../lib/platform";

export interface AccountMultiSelectProps {
  accounts: SocialAccountDto[];
  selectedIds: string[];
  onToggle: (accountId: string) => void;
}

/** Checkbox list of connected accounts, grouped by platform. */
export function AccountMultiSelect({
  accounts,
  selectedIds,
  onToggle,
}: AccountMultiSelectProps): ReactElement {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<Users size={20} />}
        title="No connected accounts yet"
        description="Connect a social account to select it as a target for this post."
        action={
          <Link
            href="/accounts"
            className="rounded-control bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            Go to Accounts
          </Link>
        }
      />
    );
  }

  const groups = new Map<string, SocialAccountDto[]>();
  for (const account of accounts) {
    const label = PLATFORM_LABELS[account.platform];
    groups.set(label, [...(groups.get(label) ?? []), account]);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(groups.entries()).map(([label, group]) => (
        <div key={label} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</h3>
          <div className="flex flex-col gap-1.5">
            {group.map((account) => {
              const checked = selectedIds.includes(account.id);
              return (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-3 rounded-control border border-subtle-2 bg-surface px-3 py-2.5 transition-colors hover:bg-sidebar-hover"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(account.id)}
                    className="h-4 w-4 accent-[color:var(--sq-accent)]"
                  />
                  <Avatar
                    name={account.displayName ?? account.platform}
                    imageUrl={account.avatarUrl}
                    platform={platformToBadge(account.platform)}
                    size="sm"
                  />
                  <span className="text-sm text-primary">
                    {account.displayName ?? PLATFORM_LABELS[account.platform]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
