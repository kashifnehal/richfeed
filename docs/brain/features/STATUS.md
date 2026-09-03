# features/STATUS.md

How real each page is. **Update this whenever a page moves between states**, as
part of that build step's commit.

_Last updated: 2026-08-29 (workspaces table + notification prefs + server-side
platform filter + real MIME detection). Determined by inspecting
`apps/web/app/` and the E2E suite, which asserts most of these against real
seeded data._

## Status legend

- **not built** — route doesn't exist or is a placeholder.
- **empty-state only** — built, but only ever exercised against an empty API
  response.
- **live data** — built and exercised against real (seeded) data, covered by E2E.

## Pages

| Page | Route | Status | Notes |
| --- | --- | --- | --- |
| Sign in | `/(auth)/sign-in` | live data | Real Supabase Auth; bad-credentials inline error. E2E-covered. Dev-mode sign-in can be clicked pre-hydration (test helper retries). |
| Sign up | `/(auth)/sign-up` | live data | Real sign-up lands in the app; client-side password-mismatch block. E2E-covered. |
| Forgot password | `/(auth)/forgot-password` | live data | Shows its confirmation state. E2E-covered. |
| Dashboard | `/(dashboard)/dashboard` | live data | Stat tiles (Failed folds in `needs_reconnect`), AttentionList (failed + needs-reconnect targets + reconnect accounts), UpcomingPreview. Live NotificationBell in the shell. |
| Accounts | `/(dashboard)/accounts` | live data | Per-status badges (connected / needs_reconnect / limited / disconnected). Every Tier-1 platform — X (Twitter), Instagram, Facebook (via a Page picker screen), Threads, LinkedIn, YouTube — connects via real OAuth through a shared connect-ticket flow (see `platforms/*.md` per platform); every other platform still shows honest "coming in the next build" messaging. Disconnect is a soft status change (`disconnected`), not a delete — history stays intact; "Remove permanently" (disconnected accounts only) is blocked while any post_targets still reference the account (see `DECISIONS.md` 2026-09-03). |
| Compose | `/(dashboard)/posts/new` | live data | Media upload to Supabase Storage, hashtag input, account multi-select (needs_reconnect accounts shown but disabled with inline reason; disconnected accounts hidden entirely), per-target scheduling + caption override, live per-platform preview, "select at least one account" guard. `media_type` inferred from upload count, not MIME. |
| Post detail / edit | `/(dashboard)/posts/[postId]` | live data | Per-target status, PublishAttemptLog (plain-language errors, never a stack trace), fix-and-reschedule / cancel / duplicate (disconnected accounts excluded from the duplicate target list). Permalink link-out icon reads a real stored `permalink_url` (migration `0005`) — populated by each adapter at publish time for every Tier-1 platform, still inert for every other platform. |
| Calendar | `/(dashboard)/calendar` | live data | Month + week grid, agenda list below md, platform + status filters. Uses the unpaginated `GET /api/posts` (which also honours `?platform` server-side as of 2026-08-29, though Calendar still filters platform client-side). |
| Queue | `/(dashboard)/queue` | live data | Sortable "Scheduled" column, server-side pagination **and** server-side platform + status filtering via `GET /api/posts?limit&offset&sort&status&platform` — "N remaining" is now exact under a platform filter. Stacked cards below sm. |
| Settings › Profile | `/(dashboard)/settings` | live data | Name / avatar via Supabase Auth. Inputs have `name`/`autocomplete`/associated labels. |
| Settings › Workspace | `/(dashboard)/settings` | live data | Reads/writes the real `workspaces` table via `GET`/`PATCH /api/workspace` (RLS: owner-only). The old `user_metadata.workspace_name` path is gone; layout + Sidebar footer ("_name_ / Workspace Admin") read the table. |
| Settings › Notifications | `/(dashboard)/settings` | live data | Real toggles (`notify_on_failed_post`, `notify_on_needs_reconnect`) persisted via `GET`/`PATCH /api/notification-preferences`. NotificationBell respects them for its in-app list. No email/push delivery — persistence only. |

## Shell / cross-page

| Piece | Status | Notes |
| --- | --- | --- |
| Dashboard shell (Sidebar + Topbar) | live data | Responsive: icon rail at lg, off-canvas drawer below lg. |
| NotificationBell | live data | Unread dot + dropdown; rows navigate to the right post / to Accounts. Includes failed + needs_reconnect, filtered by the user's notification preferences. E2E-covered. |
| UserMenu | live data | Settings, Sign out. |
| Responsive layout | verified | E2E asserts no horizontal overflow on any dashboard page at sm / md / lg. |
