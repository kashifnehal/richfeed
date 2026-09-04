"use client";

import { EmptyState } from "@richfeed/ui";
import { Facebook } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "../../../../../components/shared/Toast";
import { apiFetch, ApiError } from "../../../../../lib/api";

interface PendingPage {
  id: string;
  name: string;
}

/**
 * Lands here right after Facebook's OAuth callback — unlike every other
 * platform (one account per grant), a Facebook login can return several
 * Pages the user administers, so this picker decides which ones actually
 * get written to social_accounts (routes/oauth-facebook.ts's
 * /pending/:id + /confirm).
 */
export default function ConnectFacebookPagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const pendingId = searchParams.get("pending");

  const [pages, setPages] = useState<PendingPage[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pendingId) {
      setExpired(true);
      return;
    }
    apiFetch<{ pages: PendingPage[] }>(`/api/oauth/facebook/pending/${pendingId}`)
      .then((res) => {
        setPages(res.pages);
        setSelected(res.pages.map((p) => p.id));
      })
      .catch(() => setExpired(true));
  }, [pendingId]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleConfirm() {
    if (!pendingId || selected.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: true; connected: number }>("/api/oauth/facebook/confirm", {
        method: "POST",
        body: JSON.stringify({ pendingId, selectedPageIds: selected }),
      });
      router.replace(`/accounts?connected=facebook&count=${res.connected}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't connect those Pages. Please try again.";
      showToast(message, "error");
      setSubmitting(false);
    }
  }

  if (expired) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon={<Facebook size={22} />}
          title="This connection attempt expired"
          description="Start over from the Accounts page and connect Facebook again."
          action={
            <Link
              href="/accounts"
              className="rounded-control bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              Back to Accounts
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-card border border-subtle-2 bg-surface p-6">
      <h1 className="text-base font-semibold text-primary">Choose Facebook Pages to connect</h1>
      <p className="mt-1 text-sm text-secondary">
        Only the Pages you select are connected to RichFeed.
      </p>

      {!pages ? (
        <p className="mt-5 text-sm text-secondary">Loading...</p>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-1.5">
            {pages.map((page) => (
              <label
                key={page.id}
                className="flex cursor-pointer items-center gap-3 rounded-control border border-subtle-2 bg-surface px-3 py-2.5 transition-colors hover:bg-sidebar-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(page.id)}
                  onChange={() => toggle(page.id)}
                  className="h-4 w-4 accent-[color:var(--sq-accent)]"
                />
                <span className="text-sm text-primary">{page.name}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={selected.length === 0 || submitting}
            onClick={() => void handleConfirm()}
            className="mt-5 w-full rounded-control bg-accent px-3.5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? "Connecting..." : "Connect selected"}
          </button>
        </>
      )}
    </div>
  );
}
