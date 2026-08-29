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

## 2026-08-29 — Add docs/brain living documentation (commit TBD)

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

## 2026-08-29 — Workspaces table, notification prefs, server-side platform filter, real MIME detection (commit TBD)

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

---

## Template for future entries

```
## YYYY-MM-DD — <short title> (commit <sha>)

What shipped: <one paragraph — what a reader needs to know changed>

Deviations/known gaps: <corners cut, decisions deferred, bugs found; omit this
line entirely if the step's own report flagged none>
```
