"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { PlatformBadge } from "@richfeed/ui";
import { Plus, X } from "lucide-react";
import type { ReactElement } from "react";
import type { Platform } from "@richfeed/shared";
import { useToast } from "../../../../components/shared/Toast";
import { apiFetch } from "../../../../lib/api";
import {
  ALL_PLATFORMS,
  COMING_SOON_PLATFORMS,
  PLATFORM_LABELS,
  platformToBadge,
} from "../../../../lib/platform";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

/** Platform -> its /api/oauth/<slug>/start route. Every other enabled platform still shows the placeholder toast. */
const OAUTH_SLUG: Partial<Record<Platform, string>> = {
  twitter: "x",
  instagram: "instagram",
  facebook: "facebook",
  threads: "threads",
  linkedin_personal: "linkedin",
  youtube: "youtube",
};

export function ConnectAccountDialog(): ReactElement {
  const { showToast } = useToast();

  async function handleConnectOAuth(slug: string) {
    try {
      // A one-time connect ticket (not the raw session token) — /start is a
      // real full-page navigation, not a fetch, so it can't read an
      // Authorization header; this bridges that without putting the actual
      // access token in a URL/request log.
      const { ticket } = await apiFetch<{ ticket: string }>("/api/oauth/connect-ticket", { method: "POST" });
      window.location.href = `${API_URL}/api/oauth/${slug}/start?ticket=${encodeURIComponent(ticket)}`;
    } catch {
      showToast("Sign in again to connect an account.", "error");
    }
  }

  function handleSelectPlatform(platform: Platform) {
    const slug = OAUTH_SLUG[platform];
    if (slug) {
      void handleConnectOAuth(slug);
      return;
    }
    showToast("Not yet connected — coming in the next build.", "info");
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} />
          Connect account
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ backgroundColor: "var(--sq-text-primary)", opacity: 0.35 }}
          className="fixed inset-0 z-40"
        />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card border border-subtle-2 bg-surface p-6 shadow-lg focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-primary">
              Connect an account
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
          <Dialog.Description className="mt-1 text-sm text-secondary">
            Choose a platform to connect. Other platforms&apos; OAuth is coming in a future build.
          </Dialog.Description>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ALL_PLATFORMS.map((platform) => {
              const badge = platformToBadge(platform);
              const isComingSoon = COMING_SOON_PLATFORMS.includes(platform);

              return (
                <button
                  key={platform}
                  type="button"
                  disabled={isComingSoon}
                  onClick={() => handleSelectPlatform(platform)}
                  className={`flex flex-col items-center gap-2 rounded-control border border-subtle-2 p-4 text-center transition-colors ${
                    isComingSoon
                      ? "cursor-not-allowed opacity-50"
                      : "hover:border-accent hover:bg-sidebar-hover"
                  }`}
                >
                  {badge ? (
                    <PlatformBadge platform={badge} size="md" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-control bg-subtle-2 text-xs font-bold text-secondary">
                      {PLATFORM_LABELS[platform].slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="text-xs font-medium text-primary">
                    {PLATFORM_LABELS[platform]}
                  </span>
                  {isComingSoon ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">
                      Coming soon
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
