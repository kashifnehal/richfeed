# platforms/STATUS.md

Wiring status for every target platform. **Update this whenever a platform's
status or blocker changes**, as part of that build step's commit.

_Last updated: 2026-08-29 (docs/brain scaffold)._

## Status legend

- **not started** — no adapter file, no OAuth app, nothing.
- **stubbed (worker-only)** — the worker has a code path for it but it doesn't
  make real API calls.
- **real OAuth+publish live** — a user can connect a real account and a real
  post goes out.

## Current state

Determined by inspecting `apps/api/src/platforms/` (**does not exist**),
`apps/api/.env.example` (**no platform OAuth vars**), and the worker
(publish step is a stub). **Every platform is "not started."** The `platform`
check constraint in `0001_init_schema.sql` lists all ten values below, and the
demo seed creates accounts for several of them, but that's fixture data — no
real integration exists.

| Platform | Tier | Status | Blocker | Last updated |
| --- | --- | --- | --- | --- |
| linkedin_personal | 1 | not started | none — this is the first one to build (zero review gate) | 2026-08-29 |
| twitter (X) | 1 | not started | API access tier / cost decision | 2026-08-29 |
| linkedin_org (Company Pages) | 2 | not started | deliberately deferred — see below | 2026-08-29 |
| instagram | 1 | not started | Meta app review + Business Verification | 2026-08-29 |
| facebook | 1 | not started | Meta app review + Business Verification | 2026-08-29 |
| threads | 2 | not started | Threads API access (tied to Meta) | 2026-08-29 |
| youtube | 2 | not started | Google OAuth verification / quota | 2026-08-29 |
| tiktok | 2 | not started | TikTok content-posting API approval | 2026-08-29 |
| pinterest | 3 | not started | Pinterest app review | 2026-08-29 |
| reddit | 3 | not started | Reddit API terms / rate limits | 2026-08-29 |

> **Tier column is a placeholder.** The tiers above are a best-guess grouping,
> not transcribed from the original feasibility research (that doc is not in
> this repo). Correct this table against that research when it's to hand.

## Ordering decision

**LinkedIn personal-profile posting is built first** because it has no review
gate — connect with `w_member_social` and post, no app review required. It
gives OAuth + the worker's publish path something real to verify end to end.

**LinkedIn Company Pages (`linkedin_org`) is deliberately deferred** until the
Tier-1 platforms are live with real usage — Company Pages posting needs
additional review and there's no demo value in it until there's real activity
to show.

See `DECISIONS.md` (2026-08-28, frontend-before-OAuth) and `platforms/linkedin.md`.
