# platforms/STATUS.md

Wiring status for every target platform. **Update this whenever a platform's
status or blocker changes**, as part of that build step's commit.

_Last updated: 2026-08-29 (tier column + blockers corrected against the real
`PRODUCT.md` / `BUSINESS.md` feasibility research, now in the repo)._

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
| linkedin_personal | 1 | not started | none — free & instant, no review gate; the first integration to build | 2026-08-29 |
| twitter (X) | 1 | not started | X developer account funding — pay-per-use since Feb 2026, ~15 min, no review ($0.015/plain post, $0.20/post-with-URL) | 2026-08-29 |
| youtube | 1 | not started | Google OAuth verification / quota; the basic flow is free and fast | 2026-08-29 |
| instagram | 1 (own-account) / 2 (multi-tenant) | not started | Meta Business Verification + Advanced Access App Review — verification 1-2+ wks, review 4-8+ wks | 2026-08-29 |
| facebook | 1 (own-account) / 2 (multi-tenant) | not started | same Meta Business Verification + Advanced Access review as instagram | 2026-08-29 |
| threads | 1 (dev-mode) / 2 (production) | not started | Meta Threads App Review for production posting — up to ~20 days per Meta's 2026 guidance | 2026-08-29 |
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

**LinkedIn personal-profile posting is built first** because it has no review
gate — connect with `w_member_social` and post, no app review required. It
gives OAuth + the worker's publish path something real to verify end to end.

**LinkedIn Company Pages (`linkedin_org`) is deliberately deferred** until the
Tier-1 platforms are live with real usage — Company Pages posting needs
additional review and there's no demo value in it until there's real activity
to show.

See `DECISIONS.md` (2026-08-28, frontend-before-OAuth) and `platforms/linkedin.md`.
