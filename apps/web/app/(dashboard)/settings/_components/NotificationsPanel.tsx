"use client";

import type { NotificationPreferencesDto } from "@richfeed/shared";
import { useEffect, useState, type ReactElement } from "react";
import { useToast } from "../../../../components/shared/Toast";
import { apiFetch } from "../../../../lib/api";

const DEFAULTS: NotificationPreferencesDto = {
  notifyOnFailedPost: true,
  notifyOnNeedsReconnect: true,
};

const ROWS: { key: keyof NotificationPreferencesDto; title: string; description: string }[] = [
  {
    key: "notifyOnFailedPost",
    title: "Failed posts",
    description: "Show an alert when a scheduled post fails to publish.",
  },
  {
    key: "notifyOnNeedsReconnect",
    title: "Account reconnects",
    description: "Show an alert when an account disconnects and needs to be reconnected.",
  },
];

/**
 * Persists the per-user notification toggles (GET/PATCH
 * /api/notification-preferences). These control what the in-app
 * NotificationBell surfaces — email/push delivery isn't wired yet.
 */
export function NotificationsPanel(): ReactElement {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferencesDto>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ preferences: NotificationPreferencesDto }>("/api/notification-preferences")
      .then((res) => setPrefs(res.preferences))
      .catch(() => showToast("Couldn't load notification preferences.", "error"))
      .finally(() => setLoaded(true));
  }, []);

  async function toggle(key: keyof NotificationPreferencesDto) {
    const previous = prefs;
    const patch = { [key]: !prefs[key] } as Partial<NotificationPreferencesDto>;
    setPrefs({ ...prefs, ...patch });
    setSaving(true);
    try {
      await apiFetch("/api/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    } catch {
      setPrefs(previous);
      showToast("Couldn't save that change. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-primary">Notifications</h2>
        <p className="text-sm text-secondary">
          Choose what appears in the notifications bell. Email and push delivery aren&apos;t
          available yet.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-subtle-2 rounded-card border border-subtle-2">
        {ROWS.map((row) => {
          const on = prefs[row.key];
          return (
            <div key={row.key} className="flex items-start justify-between gap-4 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-primary">{row.title}</span>
                <span className="text-xs text-secondary">{row.description}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={row.title}
                disabled={!loaded || saving}
                onClick={() => void toggle(row.key)}
                className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-pill transition-colors disabled:opacity-60 ${
                  on ? "bg-accent" : "bg-subtle"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-pill bg-surface shadow-sm transition-transform ${
                    on ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
