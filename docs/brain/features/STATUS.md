# features/STATUS.md

How real each page is. **Update this whenever a page moves between states**, as
part of that build step's commit.

_Last updated: 2026-08-29 (docs/brain scaffold). Determined by inspecting
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
| Accounts | `/(dashboard)/accounts` | live data | 9 seeded accounts, per-status badges (connected / needs_reconnect / limited). Connect + Reconnect show honest "coming in the next build" messaging — no real OAuth. Disconnect is a hard delete (see `DECISIONS.md` 2026-08-29). |
| Compose | `/(dashboard)/posts/new` | live data | Media upload to Supabase Storage, hashtag input, account multi-select (needs_reconnect accounts shown but disabled with inline reason), per-target scheduling + caption override, live per-platform preview, "select at least one account" guard. `media_type` inferred from upload count, not MIME. |
| Post detail / edit | `/(dashboard)/posts/[postId]` | live data | Per-target status, PublishAttemptLog (plain-language errors, never a stack trace), fix-and-reschedule / cancel / duplicate. Permalink link-out icon is **inert** for every platform — correct, no real platform connected. |
| Calendar | `/(dashboard)/calendar` | live data | Month + week grid, agenda list below md, platform + status filters. Uses the unpaginated `GET /api/posts`. |
| Queue | `/(dashboard)/queue` | live data | Sortable "Scheduled" column (real refetch, asc↔desc), server-side pagination via `GET /api/posts?limit&offset&sort` — fetches + merges pages. Stacked cards below sm. `min-w-0` on the shell column so the wide table scrolls internally. |
| Settings › Profile | `/(dashboard)/settings` | live data | Name / avatar via Supabase Auth. Inputs have `name`/`autocomplete`/associated labels. |
| Settings › Workspace | `/(dashboard)/settings` | live data (partial) | Writes to `user_metadata.workspace_name` — **no `workspaces` table exists yet** (see `DECISIONS.md` 2026-08-28). |
| Settings › Notifications | `/(dashboard)/settings` | not built | "Coming soon" stub. |

## Shell / cross-page

| Piece | Status | Notes |
| --- | --- | --- |
| Dashboard shell (Sidebar + Topbar) | live data | Responsive: icon rail at lg, off-canvas drawer below lg. |
| NotificationBell | live data | Unread dot + dropdown; rows navigate to the right post / to Accounts. Includes failed + needs_reconnect. E2E-covered. |
| UserMenu | live data | Settings, Sign out. |
| Responsive layout | verified | E2E asserts no horizontal overflow on any dashboard page at sm / md / lg. |
