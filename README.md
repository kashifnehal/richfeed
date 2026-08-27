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

`pnpm dev` runs both apps in parallel with live reload:

- Web: <http://localhost:3000>
- API: <http://localhost:4000> (health check: <http://localhost:4000/health>)

The `/health` route and the web app both start with **no** env vars set — Supabase and Redis
clients are instantiated lazily and are not used yet in this milestone.

## Scripts (root)

| Command | Description |
| --- | --- |
| `pnpm dev` | Run `apps/web` and `apps/api` dev servers in parallel (persistent, uncached) |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all packages and apps |
