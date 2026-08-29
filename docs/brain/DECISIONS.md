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

## 2026-08-29 — docs/brain is maintained continuously, not reconstructed _(this commit)_

This folder was created as a living record. The convention (see `README.md`):
every future build step updates the relevant `docs/brain` files as part of its
own commit — `CHANGELOG.md` always, plus `ARCHITECTURE.md` / `platforms/*` /
`features/STATUS.md` / `DECISIONS.md` as applicable. Treated as part of "done".

## Observed drift from the scaffold prompt's assumptions (noted 2026-08-29)

The prompt that created this folder assumed `apps/api/src/platforms/` and a
LinkedIn adapter might already exist. They do not. No platform adapter of any
kind has been written yet, the worker's publish step is still a stub, and
`apps/api/.env.example` has **no** platform OAuth env vars (only `PORT`,
`SUPABASE_*`, `UPSTASH_REDIS_URL`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`).
Reality wins: `platforms/STATUS.md` and `platforms/linkedin.md` reflect the
not-started state.
