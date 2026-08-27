import type { ReactElement } from "react";

export type PlatformBadgePlatform =
  | "instagram"
  | "facebook"
  | "x"
  | "linkedin"
  | "youtube"
  | "tiktok";

export interface PlatformBadgeProps {
  platform: PlatformBadgePlatform;
  size?: "sm" | "md";
}

const MONOGRAM: Record<PlatformBadgePlatform, string> = {
  instagram: "IG",
  facebook: "FB",
  x: "X",
  linkedin: "LI",
  youtube: "YT",
  tiktok: "TT",
};

const BG_CLASS: Record<PlatformBadgePlatform, string> = {
  instagram: "bg-platform-instagram",
  facebook: "bg-platform-facebook",
  x: "bg-platform-x",
  linkedin: "bg-platform-linkedin",
  youtube: "bg-platform-youtube",
  tiktok: "bg-platform-tiktok",
};

const SIZE_CLASS: Record<NonNullable<PlatformBadgeProps["size"]>, string> = {
  sm: "h-6 w-6 rounded-[6px] text-[10px]",
  md: "h-8 w-8 rounded-control text-xs",
};

export function PlatformBadge({ platform, size = "sm" }: PlatformBadgeProps): ReactElement {
  return (
    <span
      aria-label={platform}
      className={`inline-flex items-center justify-center font-bold text-on-accent ${BG_CLASS[platform]} ${SIZE_CLASS[size]}`}
    >
      {MONOGRAM[platform]}
    </span>
  );
}
