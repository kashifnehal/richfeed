# platforms/STATUS.md

Wiring status for every target platform. **Update this whenever a platform's
status or blocker changes**, as part of that build step's commit.

_Last updated: 2026-09-18 (LinkedIn + Facebook live text publish click-through
verified; Threads OAuth start reached login, no account stored yet)._

## Status legend

- **not started** — no adapter file, no OAuth app, nothing.
- **stubbed (worker-only)** — the worker has a code path for it but it doesn't
  make real API calls.
- **real OAuth+publish live** — a user can connect a real account and a real
  post goes out.

## Current state

Determined by inspecting `apps/api/src/platforms/` (twitter, instagram,
facebook, threads, linkedin, youtube are all real; every other file still
doesn't exist), `apps/api/.env.example` (X + Meta-family + LinkedIn +
YouTube OAuth vars now present), and the worker (those six dispatch to real
adapters via a platform->adapter map; every other platform is still the
stub). Every Tier-1 platform (per `PRODUCT.md`'s rollout priority) now has
real OAuth+publish. The demo seed creates fixture accounts for several
platforms, but outside of these six that's still just fixture data — no
other real integration exists.

| Platform | Tier | Status | Blocker | Last updated |
| --- | --- | --- | --- | --- |
| linkedin_personal | 1 | **real OAuth+publish live** | none — no review gate; connect + publish (text-only / single-image) both work end to end. Live permalink pattern click-through verified 2026-09-18 | 2026-09-18 |
| twitter (X) | 1 | **real OAuth+publish live** | paused by founder choice — the X Developer API's pay-per-use credits are depleted (`402 credits depleted` on a real attempt). This is a billing decision, not a code bug — do not attempt a code fix | 2026-09-18 |
| youtube | 1 | **real OAuth+publish live** | Google OAuth app is still in testing/unverified status, capping it to invited test users until verification review passes. Blank `platform_caption_override` (`""`) used to become YouTube title "Untitled" — adapters now fall back to the post caption | 2026-09-18 |
| instagram | 1 (own-account) / 2 (multi-tenant) | **real OAuth+publish live (dev mode)** | app is still in Meta Development Mode — Business Verification + Advanced Access review needed before it can post for anyone besides invited testers. Video publish verified live as a Reel (`DdZpBMmFABj`, 2026-09-18) after switching `media_type` from deprecated `VIDEO` to `REELS` | 2026-09-18 |
| facebook | 1 (own-account) / 2 (multi-tenant) | **real OAuth+publish live (dev mode)** | same Meta Development Mode constraint as instagram. Live Page publish + permalink click-through verified 2026-09-18 on Page "RichFeed" | 2026-09-18 |
| threads | 1 (dev-mode) / 2 (production) | **real OAuth+publish live (dev mode)** | Meta Threads App Review needed for production (non-tester) posting. **No Threads `social_accounts` row yet** — 2026-09-18 OAuth `/start` reached real `threads.com/login` (scopes `threads_basic,threads_content_publish`, Railway callback) but Instagram login was not completed in that browser, so identity/publish remain unverified | 2026-09-18 |
| tiktok | — | **out of scope** | permanent founder decision, not planned | 2026-09-18 |
| pinterest | — | **out of scope** | permanent founder decision, not planned | 2026-09-18 |
| linkedin_org (Company Pages) | 3 | not started | LinkedIn Company Page Partner Program — deliberately deferred until Tier-1 is live with real usage to demo | 2026-08-29 |
| reddit | deferred (low priority) | not started | none technical — API access is trivial; the real constraint is community anti-spam norms | 2026-08-29 |

**Snapchat is out of scope** — no organic posting API exists.

> **Tier/blocker source.** As of 2026-08-29 this table is transcribed from
> `docs/brain/PRODUCT.md` ("Platform rollout priority") and `docs/brain/BUSINESS.md`
> ("Platform approval blockers"), which now live in the repo. Meta and Threads
> carry a split tier: own-account / dev-mode posting is Tier 1, posting on behalf
> of other users is Tier 2 and gated by the review in the Blocker column.

## Ordering decision

LinkedIn personal-profile posting was planned to go first (no review gate),
but **X (Twitter) ended up first in practice** — LinkedIn's developer app
credentials were still pending on the founder's side when that step ran, so
X's adapter (`apps/api/src/platforms/x.ts`) is what actually established the
route/adapter/worker-dispatch/connect-button conventions every platform
since reuses. LinkedIn's credentials landed later the same day and it (plus
YouTube) was built directly on the corrected connect-ticket pattern from
`platforms/x.md`'s later revision — see `platforms/linkedin.md`.

**LinkedIn Company Pages (`linkedin_org`) is deliberately deferred** until the
Tier-1 platforms are live with real usage — Company Pages posting needs
additional review and there's no demo value in it until there's real activity
to show.

See `DECISIONS.md` (2026-08-28, frontend-before-OAuth) and `platforms/linkedin.md`.
