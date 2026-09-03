# platforms/STATUS.md

Wiring status for every target platform. **Update this whenever a platform's
status or blocker changes**, as part of that build step's commit.

_Last updated: 2026-09-03 (LinkedIn personal + YouTube are now real
OAuth+publish, the last two Tier-1 platforms — see `platforms/linkedin.md`,
`platforms/youtube.md`. All six OAuth routes also moved to a shared
connect-ticket flow this same step — see `platforms/x.md`)._

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
| linkedin_personal | 1 | **real OAuth+publish live** | none — no review gate; connect + publish (text-only / single-image) both work end to end | 2026-09-03 |
| twitter (X) | 1 | **real OAuth+publish live** | none — connect + publish (text-only / single-image) both work end to end | 2026-09-03 |
| youtube | 1 | **real OAuth+publish live** | none technical — Google OAuth app is still in testing/unverified status, capping it to invited test users until Google's verification review passes | 2026-09-03 |
| instagram | 1 (own-account) / 2 (multi-tenant) | **real OAuth+publish live (dev mode)** | app is still in Meta Development Mode — Business Verification + Advanced Access review needed before it can post for anyone besides invited testers | 2026-09-03 |
| facebook | 1 (own-account) / 2 (multi-tenant) | **real OAuth+publish live (dev mode)** | same Meta Development Mode constraint as instagram | 2026-09-03 |
| threads | 1 (dev-mode) / 2 (production) | **real OAuth+publish live (dev mode)** | Meta Threads App Review needed for production (non-tester) posting | 2026-09-03 |
| tiktok | 2 | not started | TikTok Content Posting API audit — 2-4+ wks incl. resubmission | 2026-08-29 |
| pinterest | 2 | not started | Pinterest Standard Access — 3-4+ wks, no official SLA | 2026-08-29 |
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
