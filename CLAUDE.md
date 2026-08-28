# RichFeed — working notes for Claude Code

Social media scheduling / multi-account publishing SaaS ("The Social Queue"), currently an internal
BBR tool. Monorepo: pnpm + Turborepo, `apps/web` (Next.js App Router), `apps/api` (Fastify), `packages/ui`
(design system), `packages/shared` (types), `packages/config`. npm scope `@richfeed/*`. Local-only —
no deployment yet. Real hosted Supabase + Upstash projects, used directly from local dev.

## Project stage — read this before over-engineering anything

This is a brand-new product in active build-out, not a production system with real users or revenue
yet. Optimize for forward progress over process:

- **Don't re-verify what a subagent already live-verified.** If a background agent's report includes
  actual command output (test results, curl responses, DB query results) proving something works,
  treat that as established — spot-check at most one or two load-bearing claims (e.g. one live query
  against Postgres, one curl), don't re-run the full build/lint/test/dev-boot sequence again. Full
  independent re-verification is only worth it for changes to the RLS/auth boundary or money-handling
  logic, and even then a targeted check beats redoing everything.
- **Don't gold-plate scaffolding-stage work.** Skip exhaustive edge-case handling, extra abstraction
  layers, or defensive code for scenarios that can't occur yet (e.g. no need to handle multi-workspace
  conflicts before workspaces exist). Flag a deliberately-cut corner in the report rather than silently
  building it out.
- **Reuse throwaway scripts instead of re-authoring them.** Ad hoc DB/queue connectivity checks keep
  getting written from scratch and deleted. If you need one, put it in `apps/api/src/scripts/` as a
  small reusable tool instead — schema introspection, queue smoke tests, etc. are going to be needed
  again.

## Environment facts (don't rediscover these)

- **`apps/api/.env`**: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL`
  (must be `rediss://` — Upstash requires TLS, plain `redis://` hangs), `TOKEN_ENCRYPTION_KEY` (64 hex
  chars, `openssl rand -hex 32`), `DATABASE_URL` (admin/migration use only, see below).
- **`apps/web/.env.local`**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_API_URL`. These must stay `NEXT_PUBLIC_`-prefixed — browser-side Supabase Auth needs
  them in the client bundle. The anon key is safe to expose; RLS is the real security boundary.
- **`DATABASE_URL` must be the session-pooler connection string**
  (`postgres.<project-ref>@aws-0-<region>.pooler.supabase.com:5432`), never the direct
  `db.<project-ref>.supabase.co` host — that host only has an IPv6 address and this environment has no
  IPv6 route (confirmed: DNS resolves, TCP gets "No route to host"). Only use `DATABASE_URL` for
  one-off admin/migration scripts via `pg` — request-time app code always goes through
  `getSupabaseClient()` (REST, respects RLS).
- If a password/secret in a connection string contains `#` or `@`, it must be percent-encoded
  (`%23`, `%40`) or URL parsing silently misparses the host.
- **The Supabase MCP tools are NOT connected to this project's Supabase account** (project ref
  `mgrgkznddmagsxrvgwlb`) — they only see an unrelated org. Don't attempt `apply_migration` /
  `execute_sql` MCP calls here; use the env-var-based clients instead.
- `apps/api`'s scripts load `.env` via `tsx ... --env-file-if-exists=.env` (plain `tsx` does not
  auto-load `.env`) — follow this pattern for any new script/entrypoint in `apps/api`.
- The BullMQ worker (`apps/api/src/worker-entry.ts`) runs as its own separate process, wired into
  root `turbo.json` as a third persistent `pnpm dev` task alongside web/api. Don't merge it into
  `server.ts`.

## E2E smoke suite — run this at the end of every build step

`pnpm test:e2e` (root) → Playwright, `apps/web/e2e/`, drives a real Chromium against the live local
stack and real Supabase Auth. It signs in as the seeded demo user and asserts against the real seeded
data (dashboard stats, attention list, 9 accounts, compose disabled-account rule, publish-attempt log,
calendar month/week, queue server-side pagination + sort, settings tabs, responsive overflow at
sm/md/lg). Credentials live in git-ignored `apps/web/.env.test` (`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`);
rotate with `pnpm --filter api create-demo-user -- --user <id> --password '<new>'` (now idempotent —
resets an existing user instead of making a new one). Re-run `pnpm --filter api seed -- --user <id>` if
the seeded data has drifted. The webServer block auto-starts `pnpm dev` if nothing is on :3000.

## Design system — hard rule

Every color/radius value in `apps/web` must come from `packages/ui/tokens.css` via the Tailwind
preset — never a hardcoded hex or inline style. If pulling in any UI primitive library (shadcn/ui,
Radix, etc.), do not let its own default theme/color variables stand — adapt it to consume the
existing `sq-*` tokens instead of introducing a second color system. A grep for hex colors outside
`packages/ui/tokens.css` must return nothing.

## Secrets handling

Never ask the user to paste a raw secret/password into chat — have them add it directly to the
relevant `.env`/`.env.local` file, then verify/mask it from there.
