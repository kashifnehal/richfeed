# The Social Queue (`richfeed`)

Social media scheduling and multi-account publishing — an internal tool for Blue Beacon Research (BBR).

This repo is a pnpm + Turborepo monorepo. This first milestone is scaffolding only: a working
local dev environment with the shared, token-driven design system wired in end to end. No platform
integrations, no deployment — everything runs on localhost.

## Structure

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 15 (App Router, TypeScript, Tailwind CSS) — runs on `http://localhost:3000` |
| `apps/api` | Fastify (TypeScript) — runs on `http://localhost:4000` |
| `packages/ui` | Shared design system: CSS tokens, Tailwind preset, React components |
| `packages/shared` | Shared TypeScript types (`@richfeed/shared`) |
| `packages/config` | Shared `tsconfig` + ESLint config, consumed via `extends` |

All colors, radii and the type family live in `packages/ui/tokens.css` and are exposed to apps
through `packages/ui/tailwind.preset.ts`. Apps never hard-code color values.

## Prerequisites

- Node 20+
- pnpm via Corepack: `corepack enable`

## Setup

```bash
git clone https://github.com/kashifnehal/richfeed.git
cd richfeed
pnpm install

# env files (templates only — fill in real values where blank)
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

pnpm dev
```

`pnpm dev` (from the repo root) runs **three** processes in parallel with live reload
(`turbo run dev worker`):

- Web: <http://localhost:3000>
- API: <http://localhost:4000> (health check: <http://localhost:4000/health>)
- Publish worker: the BullMQ consumer (`apps/api/src/worker-entry.ts`), a separate
  Node process that actually pushes scheduled posts out to each platform.

> **Run `pnpm dev` from the repo root, not from `apps/api`.** `apps/api`'s own
> `pnpm dev` starts only the Fastify server — *not* the worker. With no worker
> running, a scheduled post is created and enqueued but never processed: its
> `post_targets` row sits at `pending` (or `queued`) forever, with zero
> `publish_attempts` and no error. If you see that, the worker wasn't running.

The `/health` route and the web app both start with **no** env vars set — Supabase and Redis
clients are instantiated lazily and are not used yet in this milestone.

### Where env vars live

| Var | File | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` | `apps/web/.env.local` | anon key only; `NEXT_PUBLIC_`-prefixed because browser-side Supabase Auth needs them in the client bundle — the anon key is safe to expose, RLS is the real boundary |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`, `PORT` | `apps/api/.env` | server-only; the service role key bypasses RLS and must never reach `apps/web`. `DATABASE_URL` is for one-off admin/migration scripts only (via the session pooler — the direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from many networks) |

`SUPABASE_URL` is the same underlying project URL in both files. The API loads `.env` via
`--env-file-if-exists` in its dev/start/worker scripts, so a missing file is fine but a present one is picked up.

## Scripts (root)

| Command | Description |
| --- | --- |
| `pnpm dev` | Run `apps/web`, `apps/api`, and the publish worker in parallel (persistent, uncached) |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages and apps |
