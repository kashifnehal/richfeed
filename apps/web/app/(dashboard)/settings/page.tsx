"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { ProfilePanel } from "./_components/ProfilePanel";
import { WorkspacePanel } from "./_components/WorkspacePanel";

type Tab = "profile" | "workspace" | "notifications";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "workspace", label: "Workspace" },
  { key: "notifications", label: "Notifications" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col md:overflow-visible">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-control px-3 py-2 text-left text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-accent-muted-bg text-accent-muted-text"
                : "text-secondary hover:bg-sidebar-hover hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 rounded-card border border-subtle-2 bg-surface p-6">
        {!user ? (
          <p className="text-sm text-secondary">Loading...</p>
        ) : tab === "profile" ? (
          <ProfilePanel user={user} />
        ) : tab === "workspace" ? (
          <WorkspacePanel user={user} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <h2 className="text-sm font-semibold text-primary">Notifications</h2>
            <p className="max-w-xs text-sm text-secondary">
              Notification preferences are coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
