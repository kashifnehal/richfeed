"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import type { ReactElement } from "react";
import type { Platform, PostTargetStatus } from "@richfeed/shared";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "../../lib/platform";
import { targetStatusLabel } from "../../lib/status";

const ALL_STATUSES: PostTargetStatus[] = [
  "pending",
  "queued",
  "publishing",
  "published",
  "failed",
  "needs_reconnect",
];

export interface FilterBarProps {
  platforms: Platform[];
  onPlatformsChange: (platforms: Platform[]) => void;
  statuses: PostTargetStatus[];
  onStatusesChange: (statuses: PostTargetStatus[]) => void;
}

/** Platform + status multi-select filters. Shared by Calendar (CalendarFilterBar) and Queue (QueueFilters). */
export function FilterBar({
  platforms,
  onPlatformsChange,
  statuses,
  onStatusesChange,
}: FilterBarProps): ReactElement {
  function toggle<T>(list: T[], value: T, onChange: (next: T[]) => void) {
    onChange(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const hasFilters = platforms.length > 0 || statuses.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-control border border-subtle bg-surface px-3 py-1.5 text-sm text-primary transition-colors hover:bg-sidebar-hover"
          >
            Platform{platforms.length > 0 ? ` (${platforms.length})` : ""}
            <ChevronDown size={14} className="text-secondary" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 max-h-72 w-56 overflow-y-auto rounded-card border border-subtle-2 bg-surface p-1.5 shadow-lg"
          >
            {ALL_PLATFORMS.map((platform) => (
              <DropdownMenu.CheckboxItem
                key={platform}
                checked={platforms.includes(platform)}
                onCheckedChange={() => toggle(platforms, platform, onPlatformsChange)}
                onSelect={(e) => e.preventDefault()}
                className="flex cursor-pointer items-center gap-2 rounded-control px-2.5 py-1.5 text-sm text-primary outline-none transition-colors hover:bg-sidebar-hover"
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {platforms.includes(platform) ? <Check size={14} className="text-accent" /> : null}
                </span>
                {PLATFORM_LABELS[platform]}
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-control border border-subtle bg-surface px-3 py-1.5 text-sm text-primary transition-colors hover:bg-sidebar-hover"
          >
            Status{statuses.length > 0 ? ` (${statuses.length})` : ""}
            <ChevronDown size={14} className="text-secondary" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 w-52 rounded-card border border-subtle-2 bg-surface p-1.5 shadow-lg"
          >
            {ALL_STATUSES.map((status) => (
              <DropdownMenu.CheckboxItem
                key={status}
                checked={statuses.includes(status)}
                onCheckedChange={() => toggle(statuses, status, onStatusesChange)}
                onSelect={(e) => e.preventDefault()}
                className="flex cursor-pointer items-center gap-2 rounded-control px-2.5 py-1.5 text-sm text-primary outline-none transition-colors hover:bg-sidebar-hover"
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {statuses.includes(status) ? <Check size={14} className="text-accent" /> : null}
                </span>
                {targetStatusLabel(status)}
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            onPlatformsChange([]);
            onStatusesChange([]);
          }}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
