"use client";

import { Avatar } from "@richfeed/ui";
import type { ReactElement, ReactNode } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { PLATFORM_LABELS, platformToBadge } from "../../lib/platform";
import { CaptionEditor } from "./CaptionEditor";
import { ScheduleTimePicker } from "./ScheduleTimePicker";

export interface TargetRowProps {
  account: SocialAccountDto;
  publishAt: string;
  onPublishAtChange: (iso: string) => void;
  captionOverride: string | null;
  onCaptionOverrideChange: (value: string | null) => void;
  /** Extra content on the row's right side — e.g. a PostStatusBadge in edit mode. */
  trailing?: ReactNode;
  disabled?: boolean;
}

export function TargetRow({
  account,
  publishAt,
  onPublishAtChange,
  captionOverride,
  onCaptionOverrideChange,
  trailing,
  disabled = false,
}: TargetRowProps): ReactElement {
  const badge = platformToBadge(account.platform);
  const customizing = captionOverride !== null;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-subtle-2 bg-surface p-4">
      <div className="flex items-center gap-3">
        <Avatar
          name={account.displayName ?? account.platform}
          imageUrl={account.avatarUrl}
          platform={badge}
          size="sm"
        />
        <div className="flex flex-1 flex-col leading-tight">
          <span className="text-sm font-semibold text-primary">
            {account.displayName ?? PLATFORM_LABELS[account.platform]}
          </span>
          <span className="text-xs text-secondary">{PLATFORM_LABELS[account.platform]}</span>
        </div>
        {trailing}
      </div>

      <ScheduleTimePicker value={publishAt} onChange={onPublishAtChange} label="Publish at" />

      <label className="flex items-center gap-2 text-xs font-medium text-accent">
        <input
          type="checkbox"
          disabled={disabled}
          checked={customizing}
          onChange={(e) => onCaptionOverrideChange(e.target.checked ? "" : null)}
          className="h-3.5 w-3.5 accent-[color:var(--sq-accent)]"
        />
        Customize for {PLATFORM_LABELS[account.platform]}
      </label>

      {customizing ? (
        <CaptionEditor
          value={captionOverride ?? ""}
          onChange={onCaptionOverrideChange}
          label={`Caption override for ${PLATFORM_LABELS[account.platform]}`}
          rows={3}
        />
      ) : null}
    </div>
  );
}
