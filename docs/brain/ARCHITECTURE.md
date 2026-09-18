# ARCHITECTURE.md

The real, current stack and repo layout. Update this whenever structure, stack,
or system flow changes.

_Last updated: 2026-09-18 (public legal pages at `/privacy`, `/terms`, `/data-deletion`)._

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo (`turbo.json` tasks: `dev`, `worker`, `build`, `lint`) |
| Frontend | Next.js (App Router, TypeScript, Tailwind CSS) — `apps/web`, port 3000 |
| Backend API | Fastify (TypeScript) — `apps/api`, port 4000 |
| Worker | Separate Node process (`apps/api/src/worker-entry.ts`), wired into `turbo.json` as its own persistent `worker` task — **not** merged into `server.ts` |
| Database | Supabase Postgres. Migrations in `supabase/migrations/` (`0001` core schema, `0002` workspaces, `0003` notification_preferences), applied by `pnpm --filter api migrate` (tracked in `schema_migrations`) |
| Auth | Supabase Auth (GoTrue), browser-side via `@supabase/ssr` |
| Storage | Supabase Storage — public `media` bucket, auto-created on first use, uploads proxied through the API with the service-role client (no storage RLS policies needed) |
| Queue | Upstash Redis + BullMQ (queue in `apps/api/src/queue/`, consumed by the worker) |
| Validation | Zod schemas in `packages/shared/src/schemas.ts`, shared by API and web. Per-platform media capability matrix in `packages/shared/src/capabilities.ts` (schedule-time guard + compose UI; adapters call the same helper). |
| Token crypto | AES-256-GCM (`apps/api/src/lib/crypto.ts`), `TOKEN_ENCRYPTION_KEY` (64 hex chars) |
| Design system | `packages/ui` — CSS tokens (`tokens.css`) + Tailwind preset. Hard rule: no hardcoded hex/radius anywhere in `apps/web` |
| Hosting | **Live.** Frontend on Vercel (`richfeed.social`). API + worker on Railway project `richfeed` (`5ad8a9fa-8579-48dd-a7db-38a4d0ef8a54`), environment `production`. Real hosted Supabase + Upstash. |

## Repo tree (as of this update)

```
richfeed/
├── apps/
│   ├── web/                       Next.js App Router frontend
│   │   ├── app/
│   │   │   ├── (auth)/            sign-in, sign-up, forgot-password
│   │   │   ├── (dashboard)/       accounts, calendar, dashboard, posts, queue, settings
│   │   │   │   ├── layout.tsx     dashboard shell (Sidebar + Topbar)
│   │   │   │   ├── posts/new/     Compose
│   │   │   │   └── posts/[postId]/  Post detail / edit
│   │   │   ├── (legal)/           public Privacy, Terms, Data Deletion (no auth)
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── post/              AccountMultiSelect, CaptionEditor, HashtagInput,
│   │   │   │                      MediaUploader, PlatformPreviewCard, PublishAttemptLog,
│   │   │   │                      ScheduleTimePicker, TargetRow, CalendarPostChip,
│   │   │   │                      DuplicateDialog, FilterBar
│   │   │   └── shared/            DashboardShell, ConfirmDialog, Toast, NotificationBell,
│   │   │                         UserMenu, Input, SiteFooter, LegalArticle
│   │   ├── lib/
│   │   │   ├── supabase/          client.ts (browser), server.ts (SSR)
│   │   │   ├── api.ts             typed fetch wrapper to apps/api
│   │   │   └── …                  account-status, calendar, nav, platform, queue-rows, status, legal
│   │   └── middleware.ts          session refresh + dashboard protection; `/privacy` `/terms` `/data-deletion` are public
│   └── api/
│       └── src/
│           ├── server.ts          Fastify app
│           ├── worker-entry.ts    separate worker process entrypoint
│           ├── routes/            accounts.ts, posts.ts, dashboard.ts, media.ts,
│           │                      workspace.ts, notifications.ts
│           ├── db/
│           │   ├── supabase.ts     getSupabaseClient() — REST, service-role
│           │   └── queries.ts      every query filters by userId (service role bypasses RLS)
│           ├── lib/                auth.ts (requireUser), crypto.ts (+ .test), storage.ts
│           ├── queue/              connection.ts, scheduler.ts, worker.ts
│           └── scripts/            apply-migrations, seed-demo-data, create-demo-user,
│                                   e2e-purge-user, verify-pipeline,
│                                   inspect-target (read-only post_target +
│                                   BullMQ job diagnostics)
│                                   (run via tsx --env-file-if-exists=.env)
├── packages/
│   ├── ui/                        tokens.css, tailwind.preset.ts, components/
│   │                              (Avatar, EmptyState, PlatformBadge, Sidebar,
│   │                               StatusPill, Topbar)
│   ├── shared/                    src/{index,schemas,types,capabilities}.ts  (@richfeed/shared)
│   └── config/                    shared tsconfig + ESLint config
├── supabase/migrations/           0001_init_schema, 0002_workspaces, 0003_notification_preferences
├── docs/brain/                    ← this folder
├── AGENTS.md                      current agent instructions (source of truth)
├── CLAUDE.md                      deprecated redirect → AGENTS.md (file kept so tooling that expects it still finds it)
└── turbo.json / pnpm-workspace.yaml / package.json
```

> **Note:** `apps/api/src/platforms/` is real for LinkedIn, X, YouTube,
> Instagram, Facebook, and Threads. TikTok and Pinterest stay out of scope.
> See `platforms/STATUS.md` for per-platform blockers.

## Production hosting (Railway) — last checked 2026-09-17

Verified live against Railway MCP + `GET https://richfeed-api-production.up.railway.app/health` (HTTP 200 `{"status":"ok"}`, `Access-Control-Allow-Origin: https://richfeed.social`).

| Service | Railway ID | Live deploy | Status | Start command |
| --- | --- | --- | --- | --- |
| `richfeed-api` | `722a3064-5cf6-4bd7-a9e7-f32f3969fb25` | `62e0af76-3569-453a-a5cc-c9ff2424029b` · 2026-09-05T19:37:10Z | SUCCESS, Online, 1 replica `us-west2` | `pnpm --filter api start` · healthcheck `/health` |
| `richfeed-worker` | `adadd19a-14cf-47fc-a2d7-1a539da227e8` | `9ae7b693-2048-4c6a-9ab3-b31548ea9923` · 2026-09-05T19:37:10Z | SUCCESS, Online, 1 replica `us-west2` | `pnpm --filter api run worker:prod` · no public domain |

Both services deploy from `kashifnehal/richfeed@main`, commit **`2716e3d`** (same as local `main` / `origin/main` at check time). Public API host: `https://richfeed-api-production.up.railway.app`. No staged changes, no volumes/buckets. Last 24h API HTTP: 20 requests, 0 4xx, 0 5xx. Last 24h memory ~0.27 GB API / ~0.22 GB worker, CPU idle. Worker runtime logs were empty in the fetch window (idle consumer is expected); liveness is from Railway replica status + memory, not from a job-processing log line.

The 2026-09-04 usage-audit note that one service was crashed and the other missing runtime secrets is **stale**. Both are Online; `richfeed-api` has 27 env vars including `SUPABASE_*`, `UPSTASH_REDIS_URL`, `TOKEN_ENCRYPTION_KEY`, `FRONTEND_ORIGIN`, and the six platform OAuth sets. Do not dump those values into this file.

## Data model

`0001_init_schema.sql`:

- `social_accounts` — one row per connected platform account. `platform` and
  `status` (`connected` / `needs_reconnect` / `limited`) are check-constrained
  to mirror `packages/shared/src/types.ts`. Encrypted `access_token` /
  `refresh_token`. `unique (user_id, platform, platform_account_id)`.
- `scheduled_posts` — the composed post: caption, hashtags, media_urls,
  media_type (`image` / `video` / `carousel`).
- `post_targets` — one row per (post × account) fan-out: per-target schedule
  time, caption override, status (`pending` / `queued` / `publishing` /
  `published` / `failed` / `needs_reconnect`), `platform_post_id`.
- `publish_attempts` — per-attempt log with plain-language error categories.

`0002_workspaces.sql`:

- `workspaces` — id / name / `owner_user_id` → `auth.users` / timestamps. RLS:
  **select + update only**, `owner_user_id = auth.uid()` (no user-facing insert
  or delete — a `SECURITY DEFINER` trigger on `auth.users` insert creates one
  per new user; the service-role API is the only other writer). One workspace
  per user today. Replaces `user_metadata.workspace_name`.

`0003_notification_preferences.sql`:

- `notification_preferences` — `user_id` PK → `auth.users`,
  `notify_on_failed_post` / `notify_on_needs_reconnect` booleans (default true).
  RLS select/insert/update `user_id = auth.uid()`. Persistence only — no
  delivery mechanism is wired.

- **RLS is on for every table.** The API additionally filters every query by
  `userId` / `owner_user_id` because the service-role client bypasses RLS —
  RLS is the DB-level backstop, the API filter is the request-level one.

## `schema_migrations`

`pnpm --filter api migrate` (`apps/api/src/scripts/apply-migrations.ts`) applies
`supabase/migrations/*.sql` in order via a direct `pg` connection on
`DATABASE_URL` (DDL can't go through PostgREST), recording each in a
`schema_migrations` table. `0001` (applied by hand before the runner existed) is
auto-baselined when the core schema is already present but untracked.

## System flow

```
browser (apps/web, Supabase Auth session cookie)
   │  fetch with JWT
   ▼
apps/api (Fastify)  — requireUser() verifies the JWT via supabase.auth.getUser()
   │                   before any route touches the DB
   ├──▶ Supabase Postgres (REST via getSupabaseClient, service role + explicit userId filter)
   ├──▶ Supabase Storage (media bucket, service-role upload proxy)
   └──▶ Upstash Redis / BullMQ  ──▶  worker process (worker-entry.ts)
                                        │  at scheduled time
                                        ▼
                                    platform adapters (linkedin, x, youtube, instagram, facebook, threads)
                                        │
                                        ▼
                                    writes post_targets.status + publish_attempts
```

**`apps/web` never talks to Postgres, Storage, or Redis directly — only through
`apps/api`.** The one exception is Supabase Auth, which the browser hits
directly (that's what the `NEXT_PUBLIC_` anon key is for).
