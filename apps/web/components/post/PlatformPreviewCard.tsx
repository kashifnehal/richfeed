import { Avatar } from "@richfeed/ui";
import type { ReactElement } from "react";
import type { SocialAccountDto } from "@richfeed/shared";
import { PLATFORM_LABELS, platformToBadge } from "../../lib/platform";

export interface PlatformPreviewCardProps {
  account: SocialAccountDto;
  caption: string;
  hashtags: string[];
  mediaUrls: string[];
}

/** A lightweight mock of how the post will render on the target platform. Updates live as the editor changes. */
export function PlatformPreviewCard({
  account,
  caption,
  hashtags,
  mediaUrls,
}: PlatformPreviewCardProps): ReactElement {
  const badge = platformToBadge(account.platform);
  const fullCaption = [caption, hashtags.join(" ")].filter(Boolean).join("\n\n");

  return (
    <div className="overflow-hidden rounded-card border border-subtle-2 bg-surface">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <Avatar
          name={account.displayName ?? account.platform}
          imageUrl={account.avatarUrl}
          platform={badge}
          size="sm"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-primary">
            {account.displayName ?? PLATFORM_LABELS[account.platform]}
          </span>
          <span className="text-xs text-secondary">{PLATFORM_LABELS[account.platform]}</span>
        </div>
      </div>

      {mediaUrls.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-0.5 bg-app">
          {mediaUrls.slice(0, 4).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element -- preview thumbnail of a remote, user-uploaded URL
            <img key={url} src={url} alt="" className="aspect-square w-full object-cover" />
          ))}
        </div>
      ) : null}

      <p className="whitespace-pre-wrap px-4 py-3 text-sm text-primary">
        {fullCaption || <span className="text-secondary">Your caption will appear here...</span>}
      </p>
    </div>
  );
}
