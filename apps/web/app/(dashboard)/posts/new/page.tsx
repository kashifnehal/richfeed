"use client";

import type { ScheduledPostDto, SocialAccountDto } from "@richfeed/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../../../components/shared/Toast";
import { AccountMultiSelect } from "../../../../components/post/AccountMultiSelect";
import { CaptionEditor } from "../../../../components/post/CaptionEditor";
import { HashtagInput } from "../../../../components/post/HashtagInput";
import { MediaUploader } from "../../../../components/post/MediaUploader";
import { PlatformPreviewCard } from "../../../../components/post/PlatformPreviewCard";
import { TargetRow } from "../../../../components/post/TargetRow";
import { apiFetch } from "../../../../lib/api";
import { deriveMediaType, type MediaItem } from "../../../../lib/media";

interface TargetMeta {
  publishAt: string;
  captionOverride: string | null;
}

function defaultPublishAt(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000); // +1h, rounded to the next 5 minutes
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d.toISOString();
}

export default function ComposePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<SocialAccountDto[] | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetMeta, setTargetMeta] = useState<Record<string, TargetMeta>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ accounts: SocialAccountDto[] }>("/api/accounts")
      .then((res) => setAccounts(res.accounts))
      .catch(() => setAccounts([]));
  }, []);

  function toggleAccount(accountId: string) {
    setValidationError(null);
    setSelectedIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      }
      setTargetMeta((meta) => ({
        ...meta,
        [accountId]: meta[accountId] ?? { publishAt: defaultPublishAt(), captionOverride: null },
      }));
      return [...prev, accountId];
    });
  }

  function updateTargetMeta(accountId: string, patch: Partial<TargetMeta>) {
    setTargetMeta((meta) => ({
      ...meta,
      [accountId]: { ...meta[accountId]!, ...patch },
    }));
  }

  const selectedAccounts = useMemo(
    () => (accounts ?? []).filter((a) => selectedIds.includes(a.id)),
    [accounts, selectedIds],
  );

  const mediaUrls = useMemo(() => media.map((m) => m.url), [media]);
  const { mediaType, error: mediaError } = useMemo(() => deriveMediaType(media), [media]);

  async function handleSave(mode: "queue" | "draft") {
    if (mode === "queue" && selectedIds.length === 0) {
      setValidationError("Select at least one account");
      return;
    }
    if (mediaError) {
      setValidationError(mediaError);
      return;
    }

    setSubmitting(true);
    try {
      const post = await apiFetch<{ post: ScheduledPostDto }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          caption: caption || null,
          hashtags: hashtags.length > 0 ? hashtags : null,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
          mediaType,
          targets:
            mode === "queue"
              ? selectedIds.map((id) => ({
                  socialAccountId: id,
                  publishAt: targetMeta[id]!.publishAt,
                  captionOverride: targetMeta[id]!.captionOverride,
                }))
              : [],
        }),
      });
      showToast(mode === "queue" ? "Post saved to queue." : "Draft saved.", "success");
      router.push(`/posts/${post.post.id}`);
    } catch {
      showToast("Couldn't save this post. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-card border border-subtle-2 bg-surface p-5">
          <CaptionEditor value={caption} onChange={setCaption} />
          <HashtagInput hashtags={hashtags} onChange={setHashtags} />
          <MediaUploader items={media} onChange={setMedia} />
          {mediaError ? (
            <p className="rounded-control bg-status-failed-bg px-3 py-2 text-sm text-status-failed-text">
              {mediaError}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Accounts
          </h2>
          {accounts === null ? (
            <p className="text-sm text-secondary">Loading...</p>
          ) : (
            <AccountMultiSelect
              accounts={accounts}
              selectedIds={selectedIds}
              onToggle={toggleAccount}
            />
          )}
          {validationError ? (
            <p className="rounded-control bg-status-failed-bg px-3 py-2 text-sm text-status-failed-text">
              {validationError}
            </p>
          ) : null}
        </section>

        {selectedAccounts.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Schedule per target
            </h2>
            <div className="flex flex-col gap-3">
              {selectedAccounts.map((account) => (
                <TargetRow
                  key={account.id}
                  account={account}
                  publishAt={targetMeta[account.id]?.publishAt ?? defaultPublishAt()}
                  onPublishAtChange={(iso) => updateTargetMeta(account.id, { publishAt: iso })}
                  captionOverride={targetMeta[account.id]?.captionOverride ?? null}
                  onCaptionOverrideChange={(value) =>
                    updateTargetMeta(account.id, { captionOverride: value })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSave("queue")}
            className="rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            Save to queue
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSave("draft")}
            className="rounded-control border border-subtle px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-sidebar-hover disabled:opacity-60"
          >
            Save as draft
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 lg:w-[380px] lg:shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">Preview</h2>
        {selectedAccounts.length === 0 ? (
          <p className="rounded-card border border-dashed border-subtle bg-surface px-4 py-8 text-center text-sm text-secondary">
            Select an account to see a live preview.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedAccounts.map((account) => (
              <PlatformPreviewCard
                key={account.id}
                account={account}
                caption={targetMeta[account.id]?.captionOverride || caption}
                hashtags={hashtags}
                mediaUrls={mediaUrls}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
