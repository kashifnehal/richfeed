# ARCHITECTURE.md

The real, current stack and repo layout. Update this whenever structure, stack,
or system flow changes.

_Last updated: 2026-08-29 (docs/brain scaffold, commit after d583ce3)._

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo (`turbo.json` tasks: `dev`, `worker`, `build`, `lint`) |
| Frontend | Next.js (App Router, TypeScript, Tailwind CSS) — `apps/web`, port 3000 |
| Backend API | Fastify (TypeScript) — `apps/api`, port 4000 |
| Worker | Separate Node process (`apps/api/src/worker-entry.ts`), wired into `turbo.json` as its own persistent `worker` task — **not** merged into `server.ts` |
| Database | Supabase Postgres. Single migration so far: `supabase/migrations/0001_init_schema.sql` |
| Auth | Supabase Auth (GoTrue), browser-side via `@supabase/ssr` |
| Storage | Supabase Storage — public `media` bucket, auto-created on first use, uploads proxied through the API with the service-role client (no storage RLS policies needed) |
| Queue | Upstash Redis + BullMQ (queue in `apps/api/src/queue/`, consumed by the worker) |
| Validation | Zod schemas in `packages/shared/src/schemas.ts`, shared by API and web |
| Token crypto | AES-256-GCM (`apps/api/src/lib/crypto.ts`), `TOKEN_ENCRYPTION_KEY` (64 hex chars) |
| Design system | `packages/ui` — CSS tokens (`tokens.css`) + Tailwind preset. Hard rule: no hardcoded hex/radius anywhere in `apps/web` |
| Hosting | **Local-only. Nothing is deployed.** Real hosted Supabase + Upstash projects, used directly from local dev. |

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
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── post/              AccountMultiSelect, CaptionEditor, HashtagInput,
│   │   │   │                      MediaUploader, PlatformPreviewCard, PublishAttemptLog,
│   │   │   │                      ScheduleTimePicker, TargetRow, CalendarPostChip,
│   │   │   │                      DuplicateDialog, FilterBar
│   │   │   └── shared/            DashboardShell, ConfirmDialog, Toast, NotificationBell,
│   │   │                         UserMenu, Input
│   │   ├── lib/
│   │   │   ├── supabase/          client.ts (browser), server.ts (SSR)
│   │   │   ├── api.ts             typed fetch wrapper to apps/api
│   │   │   └── …                  account-status, calendar, nav, platform, queue-rows, status
│   │   ├── middleware.ts          session refresh + route protection for (dashboard)
│   │   └── e2e/                   Playwright smoke suite (see CLAUDE.md)
│   └── api/
│       └── src/
│           ├── server.ts          Fastify app
│           ├── worker-entry.ts    separate worker process entrypoint
│           ├── routes/            accounts.ts, posts.ts, dashboard.ts, media.ts
│           ├── db/
│           │   ├── supabase.ts     getSupabaseClient() — REST, service-role
│           │   └── queries.ts      every query filters by userId (service role bypasses RLS)
│           ├── lib/                auth.ts (requireUser), crypto.ts (+ .test), storage.ts
│           ├── queue/              connection.ts, scheduler.ts, worker.ts
│           └── scripts/            seed-demo-data, create-demo-user, e2e-purge-user,
│                                   verify-pipeline   (run via tsx --env-file-if-exists=.env)
├── packages/
│   ├── ui/                        tokens.css, tailwind.preset.ts, components/
│   │                              (Avatar, EmptyState, PlatformBadge, Sidebar,
│   │                               StatusPill, Topbar)
│   ├── shared/                    src/{index,schemas,types}.ts  (@richfeed/shared)
│   └── config/                    shared tsconfig + ESLint config
├── supabase/migrations/           0001_init_schema.sql
├── docs/brain/                    ← this folder
├── CLAUDE.md                      environment gotchas + verification policy
└── turbo.json / pnpm-workspace.yaml / package.json
```

> **Note:** `apps/api/src/platforms/` does **not exist yet.** No real platform
> adapter has been written. The worker's publish step is still a stub.

## Data model (`0001_init_schema.sql`)

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
- **RLS is on for every table**, `user_id = auth.uid()`. The API additionally
  filters every query by `userId` because the service-role client bypasses RLS —
  RLS is the DB-level backstop, the API filter is the request-level one.

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
                                    platform adapters  ← DO NOT EXIST YET
                                        │
                                        ▼
                                    writes post_targets.status + publish_attempts
```

**`apps/web` never talks to Postgres, Storage, or Redis directly — only through
`apps/api`.** The one exception is Supabase Auth, which the browser hits
directly (that's what the `NEXT_PUBLIC_` anon key is for).
