# CHANGELOG.md

One dated entry per real build-step commit, oldest first. Template at the bottom —
keep future entries in that exact shape.

---

## 2026-08-27 — Scaffold Turborepo monorepo (commit d276d66)

What shipped: the empty-but-working skeleton. pnpm + Turborepo monorepo with
`apps/web` (Next.js App Router, TS, Tailwind, port 3000), `apps/api` (Fastify,
TS, port 4000), and shared packages: `packages/ui` (CSS tokens + Tailwind preset
+ a handful of presentational components), `packages/shared` (types), and
`packages/config` (shared tsconfig + ESLint). The token-driven design system is
wired end to end; apps never hardcode color. `/health` on the API and the web
app both boot with no env vars set (Supabase/Redis clients are lazy).

Deviations/known gaps: scaffolding milestone by design — no integrations, no
deployment, everything on localhost.

## 2026-08-27 — Core scheduling engine (commit 8703340)

What shipped: `supabase/migrations/0001_init_schema.sql` — `social_accounts`,
`scheduled_posts`, `post_targets`, `publish_attempts` with `updated_at`
triggers, check constraints mirroring `packages/shared/src/types.ts`, and RLS
policies (`user_id = auth.uid()`) on every table. Encrypted token storage
(AES-256-GCM, `apps/api/src/lib/crypto.ts` + test). BullMQ queue/worker pipeline
(`apps/api/src/queue/`, `worker-entry.ts` as a separate process).

Deviations/known gaps: the worker's publish step is a stub — no real platform
adapters.

## 2026-08-27 — Rename web Supabase env vars to `NEXT_PUBLIC_` (commit 8820f2c)

What shipped: `apps/web`'s Supabase URL and anon key renamed to `NEXT_PUBLIC_`
so browser-side Supabase Auth can read them from the client bundle. The anon key
is safe to expose (RLS is the real boundary). Restores standard Next.js
convention that Step 3 (real auth) needs.

## 2026-08-28 — Build real frontend app end-to-end (commit d735ecb)

What shipped: the full authenticated product, replacing the Step 1 smoke test.
Real Supabase Auth via `@supabase/ssr` (sign-up / sign-in / forgot-password,
browser + server clients, middleware session refresh + route protection).
Global dashboard shell (responsive Sidebar + Topbar, live NotificationBell, user
menu). Every page in the spec: Dashboard (stat tiles, attention list, upcoming
preview), Accounts (grouped cards, connect-flow stubs, disconnect), Compose
(media upload to Storage, hashtags, account multi-select, per-target scheduling
+ caption override, live preview, inline validation), Post detail/edit
(per-target status, publish-attempt log, fix-and-reschedule / cancel /
duplicate), Calendar (month/week + agenda, filters), Queue (sortable table /
stacked cards), Settings (Profile, Workspace, Notifications stub). Backend:
`lib/auth.ts` `requireUser()`, the full REST surface (`routes/accounts.ts`,
`posts.ts`, `dashboard.ts`, `media.ts`), Zod validation, every query
`userId`-scoped, `lib/storage.ts` server-proxied media uploads to a public
`media` bucket. Verified live against real hosted Supabase + Upstash.

Deviations/known gaps: no `workspaces` table — workspace name writes to
`user_metadata.workspace_name`. No generic error color token — form-validation
errors reuse `status-failed-*`. shadcn scaffold deliberately not introduced
(hand-built on Radix). Post permalinks inert (no OAuth yet). `media_type`
inferred from upload count, not MIME. `apps/api/src/platforms/`, the worker
publish stub, and OAuth left untouched.

## 2026-08-28 — Add CLAUDE.md (commit 56cd5ef)

What shipped: `CLAUDE.md` codifying accumulated env/infra facts (session-pooler
`DATABASE_URL` vs the IPv6-only direct host, `NEXT_PUBLIC_` requirement, `tsx`
env-file loading, separate worker process, Supabase MCP not connected to this
project) and an explicit policy against re-running full verification suites a
background agent already live-verified — this is early-stage build, not
production.

## 2026-08-28 — Demo data seed + gap audit (commit 0ebbb92)

What shipped: `apps/api/src/scripts/seed-demo-data.ts`
(`pnpm --filter api seed -- --user <uuid>`) — one realistic signed-up user with
9 social accounts across 7 platforms (every `AccountStatus`), 4 placeholder
images in Storage, 24 `scheduled_posts` / 26 `post_targets` covering every
`PostTargetStatus` including 5 distinct realistic failure categories, 3
multi-target posts, one draft. Idempotent (deletes its own prior output first).
Plus `create-demo-user.ts`. Gap audit against Step 3's own routes with real data
loaded, fixing: Dashboard "Failed" stat / AttentionList / NotificationBell now
include the `needs_reconnect` target status (not just `failed`), with a distinct
label; Compose's multi-select and Duplicate dialog now disable `needs_reconnect`
accounts with an inline reason; Queue gained a sortable "Scheduled" column and
client-side "Load more" pagination.

Deviations/known gaps: Supabase Auth (GoTrue) was unresponsive for the whole
session — `create-demo-user.ts` couldn't run live, so seeding targeted an
existing leftover auth user id, and the seed script's pre-flight
`admin.getUserById` check was removed (a hung GoTrue call wedges the connection
pool). Queue pagination is client-side / page-size-20 because `/api/posts` had
no offset/limit yet. Settings › Workspace still keys off `user_metadata`;
Notifications stays a "Coming soon" stub. Reconnect / Connect show honest
"coming in the next build" messaging. Post-detail permalink icon stays inert.

## 2026-08-29 — Playwright E2E smoke suite + real posts pagination (commit 6e489b7)

What shipped: `apps/web/e2e/` — 17 Playwright tests driving real Chromium
against the live local stack and real Supabase Auth, asserting against the
seeded demo data: sign-in, Dashboard stats/attention/bell, Accounts (9 accounts,
per-status badges), Compose (disabled `needs_reconnect` account), Post detail
(plain-language errors, never a stack trace), Calendar month/week, Queue
(server-side paging verified via network body, header re-sorts), Settings tabs,
responsive no-overflow at sm/md/lg. Credentials in git-ignored
`apps/web/.env.test`. Plus real server-side pagination for `GET /api/posts`:
`?limit&offset&sort` page at the `post_targets` level and regroup into posts,
response gains a `pagination` block; without `?limit` the full set is returned
unchanged (Calendar untouched). Queue now fetches/merges pages instead of
slicing client-side.

Deviations/known gaps: fixed along the way — Settings inputs had `<label>` with
no `htmlFor`/`id` (added name/autocomplete); Queue's wide table forced page-wide
horizontal scroll (added `min-w-0` to the shell content column).
`create-demo-user.ts` made idempotent.

## 2026-08-29 — E2E write-path coverage + per-run demo reseed; fix account disconnect (commit d583ce3)

What shipped: `e2e/global-setup.ts` now re-seeds the whole demo dataset before
every run and clears the sign-up test's throwaway account, so write-path tests
can mutate freely; a `setup` project caches the signed-in session to
`e2e/.auth/user.json`. New write-path specs (all assert server-side via the real
API): create-post flow → Queue + the "select an account" guard; cancel /
duplicate / fix-and-reschedule a target; account disconnect; notification-row
nav; real sign-up; password-mismatch block; forgot-password confirmation. New
`apps/api/src/scripts/e2e-purge-user.ts`. Full suite: 29/29 twice back-to-back
from cold.

Deviations/known gaps: bug found and fixed — `PATCH /api/accounts/:id
{ disconnect }` always 500'd for any account with `post_targets` (non-cascading
FK); `deleteSocialAccount` now clears the account's `publish_attempts` +
`targets` first, leaving parent posts intact. Flagged as a product decision, not
built out: "disconnect" is a hard delete including published-target history — a
soft-delete / `disconnected` status is the real answer (needs a migration).
Test-only: dev-mode sign-in can be clicked pre-hydration; `formSignIn()` waits +
retries.

## 2026-08-29 — Add docs/brain living documentation (commit fa76165)

What shipped: `docs/brain/` — this folder. `README.md` (purpose + maintenance
convention), `ARCHITECTURE.md` (real stack + repo tree + system flow),
`DECISIONS.md` (backfilled ADR log), `CHANGELOG.md` (this file, one entry per
build-step commit), `platforms/STATUS.md` + `platforms/linkedin.md`,
`features/STATUS.md`. `PRODUCT.md` / `BUSINESS.md` created as placeholder stubs
(the real ones are authored in the planning thread and dropped in by hand).
No app code touched — nothing under `apps/` or `packages/` modified.

Deviations/known gaps: the scaffold prompt assumed a LinkedIn adapter might
already exist; it does not. No platform adapter of any kind exists yet, the
worker publish step is still a stub, and there are no platform OAuth env vars.
Drift noted in `DECISIONS.md`.

## 2026-08-29 — Workspaces table, notification prefs, server-side platform filter, real MIME detection (commit dc59e91)

What shipped: four gap-closers on the existing engine/UI, no platform/OAuth work.
(1) **Real `workspaces` table** (migration `0002`): id / name / owner_user_id /
timestamps, RLS select+update scoped to `owner_user_id = auth.uid()`, a
`SECURITY DEFINER` `handle_new_user_workspace()` trigger on `auth.users` insert
(names from `user_metadata.workspace_name` → email local-part → "My Workspace"),
and an idempotent in-migration backfill for existing users. New
`GET`/`PATCH /api/workspace`; Settings › Workspace and the layout + Sidebar
footer ("_name_ / Workspace Admin") now read the table, not `user_metadata`.
(2) **Real media MIME detection**: `POST /api/media` reads back the content-type
Storage actually serves (HEAD on the public URL) and returns it; `MediaUploader`
now tracks `{ url, kind }` per file (browser `File.type` cross-checked against
that), and `lib/media.ts::deriveMediaType` maps 1 image → `image`, N images →
`carousel`, 1 video → `video`, and mixed / multi-video → an inline validation
error that blocks save. Replaces the old `mediaUrls.length > 1 ? carousel :
image` guess in both Compose and Post-detail.
(3) **Server-side platform filter for Queue**: `GET /api/posts?platform=` (CSV,
paged and non-paged paths), inner-joining `social_accounts` so the exact `count`
reflects the filter; Queue sends it through instead of filtering loaded rows
client-side, so "N remaining" is now exact.
(4) **Real notification preferences** (migration `0003`,
`notification_preferences` table, per-user RLS): `GET`/`PATCH
/api/notification-preferences` for `notify_on_failed_post` /
`notify_on_needs_reconnect`; Settings › Notifications is a real toggle panel;
NotificationBell filters its in-app list by them. No email/push — persistence
only.
Also: new `apps/api/src/scripts/apply-migrations.ts` + `pnpm --filter api
migrate` — a tracked (`schema_migrations`) runner over `supabase/migrations/*`
via `pg`/`DATABASE_URL`, baselining `0001` as already-applied. `seed-demo-data.ts`
now pins the demo user's workspace name + notification prefs on every reseed.
Verified live: migrations applied to hosted Supabase, backfill correct (5 users
→ 5 workspaces, demo user kept "RichFeed Demo"), all four new endpoints
exercised with a real JWT, platform filter counts confirmed exact, media upload
content-type round-trips for png + mp4. `pnpm build` / `pnpm lint` / web+api
`tsc` pass; no hardcoded hex.

Deviations/known gaps: (a) Per the task, **no automated tests were added or
updated** — verification was live curl + reading the code. The existing
`e2e/08-settings.spec.ts` still asserts the old "Notification preferences are
coming soon." copy and will fail until a future step updates it; left untouched
deliberately. (b) `workspaces` has no insert/delete RLS policy — creation is
trigger-only and deletion isn't a feature; the service-role API is the only
other writer. (c) Post-detail infers existing media's kind from file extension
(`kindFromUrl`) since a saved post only carries URLs; freshly uploaded files use
the real content-type. (d) Calendar keeps its client-side platform filter even
though the API now supports `?platform` there too — it's unpaginated so the
count was never approximate.

## 2026-08-29 — CLAUDE.md: scope verification to the change (commit 7043287)

What shipped: a `CLAUDE.md` overhaul to cut session context cost. Standing
instructions that fired unconditionally (run E2E at the end of every step, full
build/lint/dev-boot verification) are now scoped to blast radius — a
narrow/additive change gets the affected package's `tsc` plus one `curl`, not
the full sequence, and never twice; the full sequence is reserved for RLS/auth,
the queue/worker pipeline, the design tokens, or a migration. The E2E section
now says: run once, only when `apps/web`/`apps/api` runtime behaviour changed,
and explicitly skip (and say so) for docs / scripts / config. Adds an
`lsof -ti:3000` check as its own step before any `pnpm build`, and a new
"Keeping sessions cheap" section (read narrow, prefer `curl` over browser
automation, one task per session, disable the unused claude.ai MCP connectors).

Deviations/known gaps: none — `CLAUDE.md` only, no code or docs/brain content
touched.

## 2026-08-29 — Real PRODUCT.md / BUSINESS.md; platform tiers corrected (commit 0f08ebb)

What shipped: the hand-authored `PRODUCT.md` and `BUSINESS.md` replaced the
placeholder stubs the folder shipped with in `fa76165`. `platforms/STATUS.md`'s
tier column was rewritten against the now-available feasibility research (it had
been flagged as a best-guess placeholder): Tier 1 LinkedIn-personal / X /
YouTube / Meta own-account / Threads dev-mode; Tier 2 Meta multi-tenant / TikTok /
Pinterest / Threads production; Tier 3 LinkedIn Company Pages; Reddit deferred;
Snapchat out of scope. Per-platform blockers and realistic timelines were pulled
from `BUSINESS.md`'s Track A table. `DECISIONS.md` and `README.md` updated to
match. Re-running the original scaffold prompt confirmed the rest of the folder
is already current through `dc59e91`. No app code touched — nothing under
`apps/` or `packages/`.

Deviations/known gaps: still no platform adapter of any kind —
`apps/api/src/platforms/` does not exist, every platform is "not started", the
worker publish step is a stub, and there are no platform OAuth env vars.

---

## 2026-09-03 — Real X (Twitter) OAuth + publish; account disconnect is soft-delete (commit f47305b)

What shipped: the first real platform integration in the codebase.
`apps/api/src/platforms/x.ts` (adapter) + `apps/api/src/routes/oauth-x.ts`
(Authorization Code + PKCE OAuth) + worker dispatch in `queue/worker.ts` +
a real "X (Twitter)" connect button on the Accounts page — a user can connect
a real X account and schedule a real post (text-only or single-image; video/
carousel fail fast with a clear error) that actually publishes. Token refresh,
`needs_reconnect` on an auth failure, and a real permalink
(`https://x.com/{username}/status/{id}`) on Post detail are all live. See
`platforms/x.md` for the full shape, including how `/api/oauth/x/start`
identifies the user despite being a plain browser navigation with no
Authorization header (`lib/oauth-state.ts` + a query-param access token,
not a cookie — the web app's Supabase session cookie lives on a different
origin than this API).

Also shipped as a prerequisite: `PATCH /api/accounts/:id` (disconnect) is now
a soft `status='disconnected'` change instead of a hard delete — a new
`DELETE /api/accounts/:id` does permanent removal, blocked while any
`post_targets` still reference the account. Disconnected accounts stay
visible on the Accounts page (new pill) but are excluded from Compose's
account selector and the Duplicate dialog. Migration
`0004_account_disconnected_status.sql`. See `DECISIONS.md` (2026-09-03).

Deviations/known gaps: `NEXT_PUBLIC_APP_URL` in this environment's `.env` is
already set to a future production domain, so the OAuth redirect target is
hardcoded to `http://localhost:3000` (matching the existing CORS hardcoding)
rather than read from that var — see `platforms/x.md`. "Reconnect" on an
existing account (any status) is still a placeholder toast — only the
initial Connect flow is real. No avatar is fetched/stored from X yet.

## 2026-09-03 — Real Instagram + Facebook Pages + Threads OAuth/publish; Playwright E2E suite removed (commit PENDING)

What shipped: three more real platform integrations, reusing X's
conventions (`platforms/x.ts`) — `routes/oauth-instagram.ts`,
`routes/oauth-facebook.ts`, `routes/oauth-threads.ts`, and
`platforms/instagram.ts` / `facebook.ts` / `threads.ts`, all dispatched from
`queue/worker.ts` via a platform->adapter map (replacing the earlier
single `platform === "twitter"` branch). Facebook is the one platform that
can return multiple connectable accounts from one OAuth grant — its
callback hands off to a new picker screen
(`app/(dashboard)/accounts/connect/facebook/`) instead of upserting
straight back to `/accounts`, backed by a new Redis-based short-lived
key/value store (`lib/pending-store.ts`). `lib/oauth-state.ts`'s PKCE
verifier cookie is now optional (only X uses PKCE). Instagram rejects a
Personal (non-Business/Creator) account at connect time rather than storing
a row that would only fail later at publish. `post_targets.permalink_url`
(migration `0005`) is a new stored column — Instagram/Threads permalinks
are opaque and have to be fetched from the platform's own API, so every
adapter (X included, refactored to match) now returns a real
`permalinkUrl` the worker persists, and the frontend's `buildPermalinkUrl`
helper is now a plain read of that column instead of a per-platform
client-side pattern.

Also shipped: the Playwright E2E suite (`apps/web/e2e/`, `playwright.config.ts`,
the `test:e2e` scripts, `@playwright/test`) was removed at the user's
explicit request, mid-session. `CLAUDE.md`'s verification guidance was
updated to match — targeted build/lint checks and manual click-throughs,
no automated E2E step. This is a deviation from the step's own written
spec, which still called for "the full existing Playwright suite" as part
of VERIFY; superseded by the live instruction.

Deviations/known gaps: Meta's auth-failure shape (HTTP 400 + `error.code
190`, not a plain 401/403) is handled via a shared `platforms/meta-shared.ts`
helper. No refresh-before-expiry job exists for Threads'/Instagram's 60-day
long-lived tokens (flagged in `platforms/threads.md`, out of scope for this
step). The Threads OAuth route added an identity call
(`GET /v1.0/me?fields=id,username`) not present in the original build spec —
needed to populate `platform_account_id`/`display_name`, same as every
other platform's OAuth route already does. None of the four OAuth
click-throughs, and no real scheduled post to any of the three new
platforms, could be driven manually in this environment (no live browser) —
see the step's report for exactly what to click through.

## Template for future entries

```
## YYYY-MM-DD — <short title> (commit <sha>)

What shipped: <one paragraph — what a reader needs to know changed>

Deviations/known gaps: <corners cut, decisions deferred, bugs found; omit this
line entirely if the step's own report flagged none>
```
