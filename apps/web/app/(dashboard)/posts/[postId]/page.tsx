"use client";

import { PlatformBadge, StatusPill } from "@richfeed/ui";
import { ExternalLink } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ScheduledPostDto, SocialAccountDto } from "@richfeed/shared";
import { ConfirmDialog } from "../../../../components/shared/ConfirmDialog";
import { useToast } from "../../../../components/shared/Toast";
import { CaptionEditor } from "../../../../components/post/CaptionEditor";
import { HashtagInput } from "../../../../components/post/HashtagInput";
import { MediaUploader } from "../../../../components/post/MediaUploader";
import { PlatformPreviewCard } from "../../../../components/post/PlatformPreviewCard";
import { DuplicateDialog } from "../../../../components/post/DuplicateDialog";
import { PublishAttemptLog } from "../../../../components/post/PublishAttemptLog";
import { apiFetch, ApiError } from "../../../../lib/api";
import { deriveMediaType, itemsFromUrls, type MediaItem } from "../../../../lib/media";
import { buildPermalinkUrl } from "../../../../lib/permalink";
import { PLATFORM_LABELS, platformToBadge } from "../../../../lib/platform";
import { targetStatusToPill, targetStatusLabel } from "../../../../lib/status";
import { RescheduleDialog } from "./_components/RescheduleDialog";

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [post, setPost] = useState<ScheduledPostDto | null>(null);
  const [accounts, setAccounts] = useState<SocialAccountDto[]>([]);
  const [notFound, setNotFound] = useState(false);

  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [savingFields, setSavingFields] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ post: ScheduledPostDto }>(`/api/posts/${postId}`)
      .then((res) => {
        setPost(res.post);
        setCaption(res.post.caption ?? "");
        setHashtags(res.post.hashtags ?? []);
        setMedia(itemsFromUrls(res.post.mediaUrls ?? []));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
    apiFetch<{ accounts: SocialAccountDto[] }>("/api/accounts")
      .then((res) => setAccounts(res.accounts))
      .catch(() => setAccounts([]));
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const mediaUrls = media.map((m) => m.url);
  const { mediaType, error: mediaError } = deriveMediaType(media);

  async function handleSaveFields() {
    if (mediaError) {
      showToast(mediaError, "error");
      return;
    }
    setSavingFields(true);
    try {
      await apiFetch(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update",
          caption: caption || null,
          hashtags: hashtags.length > 0 ? hashtags : null,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
          mediaType,
        }),
      });
      showToast("Changes saved.", "success");
      load();
    } catch {
      showToast("Couldn't save changes. Try again.", "error");
    } finally {
      setSavingFields(false);
    }
  }

  async function handleRescheduleFailed(publishAt: string) {
    if (!post) return;
    const failed = post.targets.filter((t) => t.status === "failed");
    try {
      await Promise.all(
        failed.map((t) =>
          apiFetch(`/api/posts/${postId}`, {
            method: "PATCH",
            body: JSON.stringify({ action: "reschedule", targetId: t.id, publishAt }),
          }),
        ),
      );
      showToast("Rescheduled.", "success");
      load();
    } catch {
      showToast("Couldn't reschedule. Try again.", "error");
    }
  }

  async function handleCancelAll() {
    try {
      await apiFetch(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel_all" }),
      });
      showToast("Post canceled.", "success");
      load();
    } catch {
      showToast("Couldn't cancel this post. Try again.", "error");
    }
  }

  async function handleDuplicate(accountId: string, publishAt: string) {
    try {
      const res = await apiFetch<{ post: ScheduledPostDto }>(`/api/posts/${postId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ socialAccountId: accountId, publishAt }),
      });
      showToast("Post duplicated.", "success");
      router.push(`/posts/${res.post.id}`);
    } catch {
      showToast("Couldn't duplicate this post. Try again.", "error");
    }
  }

  if (notFound) {
    return <p className="text-sm text-status-failed-text">This post couldn&apos;t be found.</p>;
  }

  if (!post) {
    return <p className="text-sm text-secondary">Loading...</p>;
  }

  const failedCount = post.targets.filter((t) => t.status === "failed").length;
  const hasCancelable = post.targets.some((t) => t.status !== "published");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <RescheduleDialog failedCount={failedCount} onReschedule={handleRescheduleFailed} />
        <ConfirmDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title="Cancel this post?"
          description="Every target that hasn't published yet will be removed from the queue."
          confirmLabel="Cancel post"
          onConfirm={() => void handleCancelAll()}
          trigger={
            <button
              type="button"
              disabled={!hasCancelable}
              className="rounded-control border border-subtle px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-sidebar-hover disabled:opacity-50"
            >
              Cancel
            </button>
          }
        />
        <DuplicateDialog accounts={accounts} onDuplicate={handleDuplicate} />
      </div>

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
            <button
              type="button"
              disabled={savingFields || Boolean(mediaError)}
              onClick={() => void handleSaveFields()}
              className="self-start rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {savingFields ? "Saving..." : "Save changes"}
            </button>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Targets
            </h2>
            {post.targets.length === 0 ? (
              <p className="rounded-card border border-dashed border-subtle bg-surface px-4 py-6 text-center text-sm text-secondary">
                This is a draft — no accounts are targeted yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {post.targets.map((target) => {
                  const badge = target.account ? platformToBadge(target.account.platform) : null;
                  const permalinkUrl =
                    target.status === "published" && target.platformPostId && target.account
                      ? buildPermalinkUrl(target.account.platform, target.platformPostId, target.account)
                      : undefined;
                  return (
                    <div
                      key={target.id}
                      className="flex flex-col gap-3 rounded-card border border-subtle-2 bg-surface p-4"
                    >
                      <div className="flex items-center gap-3">
                        {badge ? <PlatformBadge platform={badge} /> : null}
                        <div className="flex flex-1 flex-col leading-tight">
                          <span className="text-sm font-semibold text-primary">
                            {target.account?.displayName ??
                              (target.account ? PLATFORM_LABELS[target.account.platform] : "Account")}
                          </span>
                          <span className="text-xs text-secondary">
                            {new Date(target.publishAt).toLocaleString()}
                          </span>
                        </div>
                        <StatusPill
                          status={targetStatusToPill(target.status)}
                          label={targetStatusLabel(target.status)}
                        />
                        {target.status === "published" ? (
                          permalinkUrl ? (
                            <a
                              href={permalinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open the published post"
                              className="text-secondary transition-colors hover:text-primary"
                            >
                              <ExternalLink size={15} />
                            </a>
                          ) : (
                            <ExternalLink size={15} className="text-secondary" aria-hidden="true" />
                          )
                        ) : null}
                      </div>
                      {target.publishAttempts && target.publishAttempts.length > 0 ? (
                        <PublishAttemptLog attempts={target.publishAttempts} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-[380px] lg:shrink-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">Preview</h2>
          {post.targets.filter((t) => t.account).length === 0 ? (
            <p className="rounded-card border border-dashed border-subtle bg-surface px-4 py-8 text-center text-sm text-secondary">
              No targets to preview yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {post.targets
                .filter((t): t is typeof t & { account: SocialAccountDto } => Boolean(t.account))
                .map((target) => (
                  <PlatformPreviewCard
                    key={target.id}
                    account={target.account}
                    caption={target.platformCaptionOverride || caption}
                    hashtags={hashtags}
                    mediaUrls={mediaUrls}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
