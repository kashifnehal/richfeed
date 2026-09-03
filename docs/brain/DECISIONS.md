# DECISIONS.md

ADR-style running log. One short paragraph per decision — what was decided and,
where recoverable, why. **Newest entry at the bottom.** If a decision is later
reversed, add a new entry rather than editing the old one.

Entries backfilled on 2026-08-29 from commit history and codebase inspection are
marked _(backfilled)_. Where rationale couldn't be grounded in the repo it's
marked "reason: not recorded".

---

## 2026-08-27 — Fully separate repo and infrastructure _(backfilled)_

RichFeed is its own monorepo with its own Supabase and Upstash projects. No
shared services, no shared database, no shared deploy pipeline with any other
BBR project. Reason: not recorded, but consistent with keeping a brand-new
product's blast radius contained.

## 2026-08-27 — pnpm + Turborepo, Next.js App Router + Fastify, Supabase + Upstash _(backfilled)_

Stack picked at scaffold time (commit d276d66). pnpm workspaces + Turborepo for
the monorepo; Next.js App Router for the web app; Fastify for the API; Supabase
for Postgres + Auth + Storage; Upstash Redis + BullMQ for the scheduling queue.
Reason: not recorded in detail; all are mainstream, low-ops choices suited to a
local-first solo build.

## 2026-08-27 — Multi-tenant data model (RLS by `auth.uid()`) from day one _(backfilled)_

Even though launch is single-tenant (internal BBR use), the schema
(`0001_init_schema.sql`) is `user_id`-scoped on every table with RLS policies
enforcing `user_id = auth.uid()` for select/insert/update/delete. Rationale:
retrofitting tenancy later is far more expensive than carrying it from the
start; the cost now is near zero.

## 2026-08-27 — Worker runs as its own process _(backfilled)_

The BullMQ worker (`apps/api/src/worker-entry.ts`) is a separate persistent
process, wired into `turbo.json` as a third `worker` task alongside web and api —
deliberately not folded into `server.ts`. Keeps request handling and background
publishing independent.

## 2026-08-27 — API filters by `userId` even though RLS is on _(backfilled)_

Request-time app code goes through `getSupabaseClient()` (REST, service-role
key), which **bypasses RLS**. Every query in `db/queries.ts` therefore filters
by `userId` explicitly (directly or via a join). RLS stays as the DB-level
backstop; the API filter is the request-level boundary. Two layers on purpose.

## 2026-08-27 — Token-only styling rule _(backfilled)_

Every color / radius / spacing value in `apps/web` must come from
`packages/ui/tokens.css` via the Tailwind preset — no hardcoded hex, no inline
style colors. A grep for hex colors outside `tokens.css` must return nothing.
When pulling in a primitive library (Radix), its own theme variables are not
allowed to stand — it's adapted to consume the `sq-*` tokens. Enforced as a
hard rule in `CLAUDE.md` and checked at the end of every build step.

## 2026-08-27 — `DATABASE_URL` = session pooler only, and only for admin scripts _(backfilled)_

The direct `db.<project-ref>.supabase.co` host is IPv6-only and unreachable from
this environment (DNS resolves, TCP gets "No route to host"). `DATABASE_URL`
must be the session-pooler string, and is used **only** for one-off
admin/migration scripts via `pg` — never request-time code, which always goes
through the Supabase REST client.

## 2026-08-27 — `NEXT_PUBLIC_` prefix on the web app's Supabase env vars _(backfilled)_

Commit 8820f2c renamed `apps/web`'s Supabase URL / anon key to
`NEXT_PUBLIC_*`. Browser-side Supabase Auth needs them in the client bundle.
The anon key is safe to expose because RLS is the real security boundary.

## 2026-08-28 — Track A / Track B run in parallel, never blocking _(backfilled from planning context)_

Track A = external approval gates (platform API access, business verification,
app review). Track B = engineering. They proceed independently; a Track A delay
must never idle Track B and vice versa. This is the reason for the next
decision.

## 2026-08-28 — Frontend before OAuth _(backfilled)_

Build a real, clickable, fully-wired UI against real (initially empty) API
responses **before** wiring any live platform connection (commit d735ecb). So
that when OAuth work starts, there's a real product for it to verify against,
and Track A's timelines don't gate UI progress. Connect / Reconnect flows ship
with honest "coming in the next build" messaging rather than fake success.

## 2026-08-28 — No `workspaces` table yet; workspace name lives in user metadata _(backfilled)_

The schema is multi-tenant-*shaped* but there's no `workspaces` table. Settings
› Workspace writes the workspace name to `user_metadata.workspace_name` via
Supabase Auth. Flagged as a known gap to revisit when a real workspaces table
exists (needs a migration).

## 2026-08-28 — Reuse `status-failed` tokens for form-validation errors _(backfilled)_

`tokens.css` has no generic `danger`/`error` color — status colors are
documented "post/account status only." Rather than add a new hex value and
break the hex-grep rule, generic form-validation error text reuses
`status-failed-text` / `status-failed-bg`. A deliberate small compromise to
keep one color system.

## 2026-08-28 — shadcn/ui scaffold deliberately not introduced _(backfilled)_

Dialog / DropdownMenu are hand-built directly on `@radix-ui/react-*` primitives
and styled only with `@richfeed/ui` token classes. shadcn's `globals.css` /
HSL defaults were never added — they'd introduce a second color system and
break the hex-grep rule.

## 2026-08-28 — Leaner verification policy for this stage _(backfilled)_

`CLAUDE.md` (commit 56cd5ef) sets an explicit policy: don't re-run full
build/lint/test/dev-boot verification that a background agent already
live-verified with real command output. Full independent re-verification is
reserved for RLS/auth-boundary and money-handling changes. This is a
brand-new product, not production — optimize for forward progress.

## 2026-08-28 — Ad hoc DB/queue scripts go in `apps/api/src/scripts/` _(backfilled)_

Connectivity checks and seed/introspection scripts kept getting re-authored and
deleted. Policy now: put reusable tools in `apps/api/src/scripts/` (loaded via
`tsx --env-file-if-exists=.env`). Current residents: `seed-demo-data`,
`create-demo-user`, `e2e-purge-user`, `verify-pipeline`.

## 2026-08-29 — "Disconnect account" is a hard delete, for now _(backfilled)_

`PATCH /api/accounts/:id { disconnect }` hard-deletes the account plus its
`publish_attempts` and `post_targets` (FK-safe order), leaving parent posts
intact. It was 500ing for any account that had targets because
`post_targets.social_account_id` is a non-cascading FK. The real long-term
answer is a soft-delete / `disconnected` status (needs a migration); flagged as
a product decision, not built out.

## 2026-08-29 — E2E suite re-seeds the demo dataset before every run _(backfilled)_

`e2e/global-setup.ts` runs `pnpm --filter api seed` from scratch before every
`pnpm test:e2e` and clears the sign-up test's throwaway account, so write-path
tests can mutate freely. A `setup` Playwright project signs in once and caches
the session to `e2e/.auth/user.json` so GoTrue's `/token` isn't hammered; auth
specs opt out. Read specs (01–09) must run before write specs (10–14) within a
run.

## 2026-08-29 — `workspaces` is a real table; `user_metadata.workspace_name` is retired

Workspace name moved off Supabase Auth `user_metadata` into a `workspaces`
table (migration `0002`) so workspace-level settings have a real home. One
workspace per user, `owner_user_id`-scoped, auto-created by a `SECURITY
DEFINER` trigger on `auth.users` insert (name from `user_metadata.workspace_name`
→ email local-part → "My Workspace") and backfilled in-migration for existing
users. RLS deliberately exposes **select + update only** — workspace creation is
automatic and deletion isn't a feature, so there's no user-facing insert/delete
path. Reason: the stopgap was explicitly flagged as temporary since Step 3.

## 2026-08-29 — media_type comes from real file types, not upload count

Compose/Post-detail used to guess `media_type` as `count > 1 ? carousel :
image`. Now `POST /api/media` reads back the content-type Supabase Storage
serves (HEAD on the public URL), the uploader tracks a real image/video `kind`
per file (browser `File.type` cross-checked against Storage's), and
`deriveMediaType` maps them (1 image → image, N images → carousel, 1 video →
video) or raises an inline validation error for a mixed/multi-video selection
that blocks save. Reason: the guess was a known Step-3 deviation and silently
mislabelled every video post as an image.

## 2026-08-29 — Queue platform filtering is server-side

`GET /api/posts` gained a `?platform=` filter (CSV, inner-joins
`social_accounts` so the exact `count` reflects it). Queue sends its platform
filter through instead of filtering already-paginated rows client-side, which is
what made the "N remaining" count approximate under a platform filter. Reason:
a corner Step 6 deliberately cut.

## 2026-08-29 — Notification preferences: persist, don't deliver

`notification_preferences` table (migration `0003`) + `GET`/`PATCH
/api/notification-preferences` + a real Settings toggle panel, storing
`notify_on_failed_post` / `notify_on_needs_reconnect`. NotificationBell honours
them for its in-app list. Actual email/push delivery is explicitly out of scope
— no provider, no new dependency — so the toggles currently only gate the bell.
Reason: scoped honestly to what's buildable without an email integration.

## 2026-08-29 — Migrations get a tracked runner (`pnpm --filter api migrate`)

`apps/api/src/scripts/apply-migrations.ts` applies `supabase/migrations/*.sql`
in order over a direct `pg`/`DATABASE_URL` connection (DDL can't go through
PostgREST), tracked in `schema_migrations`; `0001` (applied by hand via the
Supabase SQL editor before this existed) is auto-baselined. Reason: `0002`/`0003`
needed a repeatable, reviewable apply path, and CLAUDE.md wants reusable tools in
`scripts/` rather than re-authored one-offs.

## 2026-08-29 — docs/brain is maintained continuously, not reconstructed _(originally this commit)_

This folder was created as a living record. The convention (see `README.md`):
every future build step updates the relevant `docs/brain` files as part of its
own commit — `CHANGELOG.md` always, plus `ARCHITECTURE.md` / `platforms/*` /
`features/STATUS.md` / `DECISIONS.md` as applicable. Treated as part of "done".

## 2026-08-29 — Real PRODUCT.md / BUSINESS.md landed; platform tiers corrected against the research

The hand-authored `PRODUCT.md` and `BUSINESS.md` (written in the planning
thread) replaced the placeholder stubs the folder shipped with. With the
competitor and approval-blocker research now in the repo, `platforms/STATUS.md`'s
tier column — previously flagged as a best-guess placeholder — was rewritten to
match: **Tier 1** LinkedIn-personal / X / YouTube / Meta own-account / Threads
dev-mode; **Tier 2** Meta multi-tenant / TikTok Direct Post / Pinterest Standard
Access / Threads production; **Tier 3** LinkedIn Company Pages; Reddit deferred
(the constraint is community anti-spam norms, not engineering); Snapchat out of
scope (no posting API). The positioning wedge is recorded as reliability +
billing transparency, not feature count. Re-running the docs/brain scaffold
prompt otherwise found the folder already present and current through commit
`dc59e91` — no structural rebuild was needed, only the PRODUCT/BUSINESS swap and
this tier correction.

## 2026-09-03 — "Disconnect account" is a soft status change, reversing the 2026-08-29 hard delete

`PATCH /api/accounts/:id { disconnect }` now sets `status='disconnected'`
instead of deleting the row and cascading through `post_targets` /
`publish_attempts`. A new `DELETE /api/accounts/:id` does the actual
permanent removal, blocked (409) while any `post_targets` still reference the
account. Migration `0004_account_disconnected_status.sql` adds
`'disconnected'` to the status check constraint. Reason: real platform
connections (X/Twitter, this same step) make losing publish history on every
disconnect an actual cost, not just a theoretical one — flagged as the real
long-term answer back in the original hard-delete entry.

## Observed drift from the scaffold prompt's assumptions (noted 2026-08-29)

The prompt that created this folder assumed `apps/api/src/platforms/` and a
LinkedIn adapter might already exist. They do not. No platform adapter of any
kind has been written yet, the worker's publish step is still a stub, and
`apps/api/.env.example` has **no** platform OAuth env vars (only `PORT`,
`SUPABASE_*`, `UPSTASH_REDIS_URL`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`).
Reality wins: `platforms/STATUS.md` and `platforms/linkedin.md` reflect the
not-started state.
