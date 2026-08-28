import type { ReactElement } from "react";
import { PlatformBadge, type PlatformBadgePlatform } from "./PlatformBadge";

export interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  platform?: PlatformBadgePlatform | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

const BADGE_SIZE: Record<NonNullable<AvatarProps["size"]>, "sm" | "md"> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Connected-account avatar with a small platform-icon badge overlay. */
export function Avatar({ name, imageUrl, platform, size = "md" }: AvatarProps): ReactElement {
  return (
    <span className="relative inline-flex shrink-0">
      {imageUrl ? (
        // packages/ui is framework-agnostic (no next/image dependency), so a plain <img> is intentional here.
        <img
          src={imageUrl}
          alt={name}
          className={`rounded-pill object-cover ${SIZE_CLASS[size]}`}
        />
      ) : (
        <span
          className={`flex items-center justify-center rounded-pill bg-accent-muted-bg font-bold text-accent-muted-text ${SIZE_CLASS[size]}`}
        >
          {initials(name)}
        </span>
      )}
      {platform ? (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-pill ring-2 ring-surface">
          <PlatformBadge platform={platform} size={BADGE_SIZE[size]} />
        </span>
      ) : null}
    </span>
  );
}
