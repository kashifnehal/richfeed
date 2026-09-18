# RichFeed — Agent Instructions

Read this whole file before touching any code. It is the standing context for this repo: what RichFeed is, why it's built the way it is, what's already broken and known-about, and the house rules that past work has learned the hard way. Nothing here is generic boilerplate — every rule exists because skipping it already cost real time once.

After reading this file, also read `docs/brain/README.md` and everything under `docs/brain/` (PRODUCT.md, BUSINESS.md, ARCHITECTURE.md, DECISIONS.md, STATUS.md, features/STATUS.md, platforms/STATUS.md, platforms/*.md). Those files are the git-native "living memory" of this project and are meant to be kept current by whoever last touched the code — that includes you. If anything in `docs/brain` contradicts this file, prefer the more recently-dated source and flag the conflict instead of silently picking one.

Do not write or propose any code change until you can summarize back, in your own words: what RichFeed is for, what platforms it supports today and their real limitations, and what the currently-open bugs are. If you can't, keep reading first.

## 1. What RichFeed is and why

RichFeed is a social-media scheduling and multi-account publishing SaaS, built by founder Kashif Nehal originally for his own business use — reliability for his own day-to-day posting came before feature breadth. The product thesis, deliberately, is **reliability and visibility, not more features**: competitors (Buffer, Hootsuite, Later, Publer, SocialBee, Metricool) already have deep feature sets; RichFeed's differentiation is that a scheduled post either publishes correctly and you can prove it did, or you get told clearly why it didn't — never a silent failure or a confident-looking status that turns out to be wrong.

This has a direct implication for how you should work: a "looks done" UI state (a "Scheduled" or "Published" badge, a confident agent report) is never treated as proof. Proof is the actual database row's status/`platform_post_id`/permalink, and — where practical — checking the real platform. This project has been burned more than once by trusting the UI or a confident report instead of checking underlying state. Verify before reporting something fixed or working.

Platform scope is deliberately narrow: **Meta (Instagram, Facebook Pages, Threads), X, LinkedIn (personal), and YouTube**. TikTok and Pinterest were evaluated and are permanently out of scope — do not add them or suggest adding them back. X integration currently exists in code but is paused by founder choice (billing/credits — `402 credits depleted`); don't "fix" that by changing code, it's a billing decision.

## 2. Architecture

- Monorepo: pnpm + Turborepo. npm scope `@richfeed/*`.
- `apps/web` — Next.js (App Router) frontend, deployed on Vercel, production domain richfeed.social.
- `apps/api` — Fastify API + BullMQ queue producer, deployed on Railway as service `richfeed-api`.
- A separate Railway service, `richfeed-worker`, runs the BullMQ consumer that actually calls out to each platform's API. It's its own persistent process (`apps/api/src/worker-entry.ts`), wired into root `turbo.json` as a third `pnpm dev` task alongside web/api — don't merge it back into `server.ts`.
- `packages/ui` — shared design system. `packages/shared` — shared types. `packages/config` — shared config.
- Supabase Postgres is the database (project ref `mgrgkznddmagsxrvgwlb`).
- Upstash Redis is the BullMQ backend.
- Railway project ref: `5ad8a9fa-8579-48dd-a7db-38a4d0ef8a54`.

**Note on project stage:** an earlier version of this repo's agent instructions (`CLAUDE.md`, written before production existed) described RichFeed as "local-only, no deployment yet" and told the coding agent to skip re-verification and optimize for speed over process. That is no longer true and should not be followed — the product is live in production (richfeed.social, real OAuth-connected accounts, real scheduled posts), and the verification discipline in §6 exists specifically because skipping it already caused real incidents. If you see stale guidance like this anywhere (including in `docs/brain`), flag it rather than following it.

### Local dev environment facts
- `apps/api/.env`: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL` (must be `rediss://` — Upstash requires TLS; plain `redis://` hangs), `TOKEN_ENCRYPTION_KEY` (64 hex chars, `openssl rand -hex 32`), `DATABASE_URL` (admin/migration use only — see below).
- `apps/web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`. These must stay `NEXT_PUBLIC_`-prefixed since browser-side Supabase Auth needs them in the client bundle — the anon key is safe to expose, RLS is the real security boundary.
- `DATABASE_URL` must be the session-pooler connection string (`postgres.<project-ref>@aws-0-<region>.pooler.supabase.com:5432`), never the direct `db.<project-ref>.supabase.co` host — that host only resolves to IPv6 and local dev environments here have had no IPv6 route. Only use `DATABASE_URL` for one-off admin/migration scripts via `pg`; request-time app code always goes through `getSupabaseClient()` (REST, respects RLS).
- A password/secret in a connection string containing `#` or `@` must be percent-encoded (`%23`, `%40`) or URL parsing silently misparses the host.
- `apps/api`'s scripts load `.env` via `tsx ... --env-file-if-exists=.env` (plain `tsx` does not auto-load `.env`) — follow this pattern for any new script/entrypoint in `apps/api`.
- **Historical gotcha, confirmed to have actually happened on this repo:** a generic/marketplace Supabase MCP connection has previously connected to the wrong Supabase org entirely (not this project's `mgrgkznddmagsxrvgwlb`) when it wasn't explicitly scoped with a `project_ref`. Always confirm an MCP Supabase/Railway/Vercel tool call is hitting the right project before trusting its output, especially if more than one project's tooling is set up on the same machine.
- Before any `pnpm build`, check for a running dev server first (`lsof -ti:3000`). **Never run `pnpm build` while `pnpm dev` is running** — `next build` and `next dev` share `apps/web/.next`, and a concurrent build corrupts the dev server's client bundle (sign-in stops hydrating; forms fall back to a native GET submit). Recovery is kill dev, `rm -rf apps/web/.next`, restart, re-verify — cheaper to just not do it.

### Design system — hard rule
Every color/radius value in `apps/web` must come from `packages/ui/tokens.css` via the Tailwind preset — never a hardcoded hex or inline style. If pulling in any UI primitive library (shadcn/ui, Radix, etc.), adapt it to consume the existing `sq-*` tokens instead of introducing a second color system. A grep for hex colors outside `packages/ui/tokens.css` should return nothing.

### Secrets handling
Never ask the founder to paste a raw secret/password into chat — have them add it directly to the relevant `.env`/`.env.local` file (or the hosting platform's env var UI), then verify/mask it from there.

### Publish-queue design (do not casually change)
`enqueuePublishJob()` uses a **deterministic `jobId = post_target.id`** specifically for idempotency — re-enqueuing the same target is a no-op, not a duplicate job. The worker has a `pending`-status guard against double-publish. Cancelling a scheduled post removes its queued job. The BullMQ `Worker` is configured with `drainDelay: 60` and `stalledInterval: 5 * 60 * 1000` — this was a deliberate fix for an Upstash cost leak; don't revert it without understanding why it's there.

Scheduling jitter (posts actually publish 2–5 minutes after their scheduled time) is **intentional**, not a bug — don't "fix" it.

### OAuth pattern
All platform connects use a **connect-ticket pattern**: a short-lived, single-use ticket is passed through the redirect URL instead of a raw session token. `FRONTEND_ORIGIN` is a shared env var used to build these redirect URLs correctly across environments. Reference implementations: `apps/api/src/routes/oauth-x.ts` and `oauth-linkedin.ts`. Follow this exact pattern for any new or modified OAuth flow — don't invent a different token-passing scheme.

## 3. Real per-platform capability matrix (verified from the actual adapter code, not assumptions)

| Platform | Text-only | Image | Video | Carousel |
|---|---|---|---|---|
| LinkedIn (personal) | Yes | Yes | No — explicitly rejected in code | Yes — Posts API `content.multiImage` (2–20 images). Not the sponsored Carousel API. |
| Facebook (Page) | Yes | Yes | No — explicitly rejected in code | Yes — unpublished `/{page-id}/photos` then `/{page-id}/feed` `attached_media` (2–10 images) |
| Threads | Yes | Yes | No — explicitly rejected in code | Yes — child containers (`is_carousel_item=true`) then parent `media_type=CAROUSEL` (2–20 images) |
| X | Yes | Yes | No — explicitly rejected in code | No — paused by founder billing choice; out of the carousel pass |
| Instagram | No — media required | Yes | Yes — publishes as a Reel (`media_type=REELS`, verified live 2026-09-18) | Yes — child containers then parent `media_type=CAROUSEL` (2–10 images). Meta allows mixed image/video children (`VIDEO`, not `REELS`); compose still rejects mixed. |
| YouTube | No — video required | No — video required | Required (live verified 2026-09-18) | N/A — no carousel concept |

`assertSupportedMedia()` in every adapter calls `unsupportedMediaReason()` from `packages/shared/src/capabilities.ts` — that file is the single source of truth. Video is still rejected on LinkedIn/Facebook/Threads/X. Carousel is rejected on X and YouTube. Schedule-time `POST /api/posts` 400 and the compose UI both read the same matrix.

Instagram (`apps/api/src/platforms/instagram.ts`) uses `GRAPH_HOST = "graph.instagram.com"` (the standalone "Instagram API with Instagram Login" product — not `graph.facebook.com`). Do not change the working REELS video path when touching carousel.

**Pre-schedule validation:** the old "user can schedule video to LinkedIn and only find out after it fails" gap was fixed 2026-09-18. Carousel item-count bounds (IG/FB 2–10, LinkedIn/Threads 2–20) are checked in the same helper when a URL count is provided.

## 4. Per-platform OAuth / setup gotchas already learned

- **Meta (Facebook/Instagram/Threads):** redirect URIs must be HTTPS — no localhost. Instagram's own redirect URI configuration is NOT on the general "Facebook Login for Business" settings page; it lives under Use Cases → "Manage messaging & content on Instagram" → Customize → "API setup with Instagram login" → section 4. Instagram tester invites require the specific "Instagram tester" role (not a generic collaborator role) and must be accepted via instagram.com in a browser — not the Instagram phone app — under Edit Profile → Authorized Applications → Tester Invites.
- **Google/YouTube:** OAuth apps default to "Testing" publishing status in Google Cloud Console, which requires every connecting Google account to be explicitly added as a Test User (APIs & Services → OAuth consent screen / Audience → Test users) — this is true even though the RichFeed *app itself* is deployed to production; "in production" (the app is live) and "OAuth app verified for public use" (Google's separate verification track) are different things. Scopes requested in code (the `SCOPE` constant in `apps/api/src/routes/oauth-youtube.ts`) must also be separately registered in Google Cloud Console under OAuth consent screen → Data Access → Add or Remove Scopes — a code-only scope change does nothing until that dashboard step is also done manually by the founder.
- **Production scaling blockers (documented for the eventual "10,000 users" push, not urgent today):** Meta requires Business Verification + App Review to serve real end-users at scale on Instagram/Facebook/Threads. LinkedIn currently requires no equivalent approval step. YouTube has two separate gates: (1) OAuth consent-screen production verification (~3-5 day Google review) and (2) a platform-wide quota ceiling of roughly 100 video uploads/day per API project — flagged as the most likely scaling wall, likely to bind well before 10,000 users, realistically within a few dozen active daily-posting customers. X's pay-per-use billing and shared rate limits are a separate cost/reliability risk at scale.

## 5. Currently open, real bugs (as of 2026-09-18)

None of the three original publish bugs are still open. Struck-through history below. Remaining non-code constraints: Google OAuth app is still in testing/unverified status; Meta app is still in Development Mode; X is paused by founder billing choice (`402 credits depleted`).

1. **~~No pre-schedule media-type validation.~~ Fixed 2026-09-18.** Shared matrix in `packages/shared/src/capabilities.ts`; `POST /api/posts` / reschedule / duplicate / update 400 before insert/enqueue; compose UI blocks Save to queue. Instagram video is still allowed at schedule time (the adapter allows it).
2. **~~Instagram video 400 "Invalid parameter".~~ Diagnosed and verified 2026-09-18.** Worker log on `6c28f23c-…`: Meta `error_subcode=2207067` — `media_type=VIDEO` is deprecated, use `REELS`. Adapter now sends `REELS` + `share_to_feed=true`. **Live verified** on post `e81f5bdd-…` / target `36dbcf47-…` → Reel `https://www.instagram.com/reel/DdZpBMmFABj/` (`platform_post_id=17980625222904328`). That 400 had also been misclassified as `AUTH_FAILED` (`OAuthException`); `isMetaAuthError` now only treats 401/403 / code 190 as auth.
3. **~~YouTube video upload 401.~~ Not reproduced on 2026-09-18.** Real post `10d283e3-…` published (`platform_post_id=57N_oV8sQC0`, live on the channel). No YouTube adapter change. Earlier 401 unexplained; not the current live state.
4. **~~YouTube title "Untitled" from empty caption override.~~ Fixed 2026-09-18.** Post `e81f5bdd-…` / target `9ea4ceb4-…` published `1GWekfH9dYE` with oEmbed title `"Untitled"` because `platform_caption_override=""`. `resolvePlatformCaption` + Zod/insert now treat whitespace-only override as unset. The already-published video was not patched.

Google OAuth app is still in testing/unverified status. Meta app is still in Development Mode.

## 6. House rules (non-negotiable — each one exists because of a real incident)

- **Never write or reintroduce automated tests.** The Playwright E2E suite was deliberately deleted (commit `c78fc47`) as a founder decision. Verify manually / by reading real logs and DB state instead. If you use a Playwright MCP tool for ad-hoc verification during a session, that's fine — just don't check in a test suite.
- **Every commit that's meant to ship must be explicitly pushed, not just committed.** A prior incident: a bug fix was committed locally and reported as "done," but never pushed, so Railway never redeployed it and ~20 minutes were lost before this was caught. Always run (and confirm) `git push` as an explicit step, and say so in your final report.
- **Verify before reporting.** Don't report a bug fixed, a feature working, or a deploy live based on a build passing or a UI badge looking right. Check the actual Railway deployment status/logs, the actual Supabase row, or the actual platform API response. If you can't verify something directly, say so explicitly rather than implying it's confirmed.
- **Update `docs/brain/` as part of the same commit** whenever you touch something it tracks: CHANGELOG.md always; ARCHITECTURE.md if structure/stack changed; `platforms/STATUS.md` and the specific `platforms/<name>.md` if a platform's status or a bug's status changed; `features/STATUS.md` if a page's realness changed; DECISIONS.md if a real product/architecture decision was made or reversed. This is the only context store Cursor (or any future coding agent working straight off the git repo) can see — keep it honest and current, including fixing PRODUCT.md's "Current build status" section if you notice it's stale (it was last seen claiming several now-live platforms were "not yet wired").
- **Don't invent scope.** If a request implies adding a new platform, writing tests, or changing the OAuth token pattern, stop and flag it rather than proceeding — those are founder-level decisions that have already been made once.

## 7. When you're done with a task — always give a detailed report

Every task ends with a written report, not just a diff and a "done." Include, every time:

- What you changed and why, file by file if more than one file was touched.
- The exact commit SHA(s), and explicit confirmation that you ran `git push` (not just `git commit`) and it succeeded.
- What you personally verified and exactly how — a real log line, a real DB query result, a real API response, a real screenshot. Never "should work now" or "this looks correct" as a substitute for actually checking.
- Anything you could NOT verify, stated plainly as unverified — don't imply something works when you only inspected the code.
- Any manual/dashboard-side step the founder still needs to do that code alone can't do (e.g., a Google Cloud Console scope registration, a Meta App Review submission, an env var to set on Railway/Vercel).
- Any `docs/brain/` files you updated as part of this task.
- Anything you deliberately did NOT do that the task might have implied (scope you cut, an edge case you skipped, a decision you weren't sure was yours to make) — flag it instead of silently deciding.

Skipping this report, or shortening it to "fixed it, pushed" is not acceptable — the founder has been burned before by confident-but-wrong short reports and needs enough detail to independently sanity-check the claim.

### Keeping sessions efficient (this still matters, verification discipline doesn't excuse waste)
- Read narrow: open the specific routes/functions/components the task names rather than reading a dozen files "to get oriented." `docs/brain/ARCHITECTURE.md` and `docs/brain/features/STATUS.md` already describe the stack, repo tree, data model and per-feature status — read those instead of re-deriving them.
- Prefer cheap live checks: `curl` the running API and read the code over driving a browser for routine checks. Reserve actual browser automation (Playwright MCP) for cases that genuinely need a rendered page.
- Don't restate a full report three times (commit message, chat, `docs/brain/CHANGELOG.md`) — write the detail once in the report/CHANGELOG entry, keep the commit message short and pointed to it.