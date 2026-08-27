import { PlatformBadge, Sidebar, StatusPill, Topbar } from "@richfeed/ui";
import type { PlatformBadgePlatform, StatusPillStatus } from "@richfeed/ui";

const STATUSES: StatusPillStatus[] = [
  "scheduled",
  "published",
  "failed",
  "needs-reconnect",
  "queued",
];

const PLATFORMS: PlatformBadgePlatform[] = [
  "instagram",
  "facebook",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar active="dashboard" />

      <div className="flex flex-1 flex-col">
        <Topbar title="Dashboard" hasAlert={true} />

        <main className="flex-1 space-y-8 bg-app p-8">
          <p className="max-w-2xl text-sm text-secondary">
            Design-system smoke test — every color, radius and the type family below
            is sourced from the shared <code>@richfeed/ui</code> token layer, not
            hard-coded in this app.
          </p>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Post status
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {STATUSES.map((status) => (
                <StatusPill key={status} status={status} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Platforms
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {PLATFORMS.map((platform) => (
                <PlatformBadge key={platform} platform={platform} size="md" />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Surface
            </h2>
            <div className="max-w-md rounded-card border border-subtle-2 bg-surface p-5 text-sm text-primary">
              This card uses <code>--sq-bg-surface</code>,{" "}
              <code>--sq-border-subtle-2</code> and <code>--sq-radius-card</code>.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
