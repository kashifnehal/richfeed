# platforms/linkedin.md

**Status: not wired yet.** As of 2026-08-29 there is no `apps/api/src/platforms/`
directory and no `linkedin.ts`. This file is a stub placeholder.

## Plan (not yet built)

LinkedIn **personal-profile** posting is the first platform integration to be
built, because it has no app-review gate (see `platforms/STATUS.md` and
`DECISIONS.md`). When `apps/api/src/platforms/linkedin.ts` is written, this file
should be filled in with:

- **OAuth scopes** requested (expected: `openid`, `profile`, `w_member_social`).
- **Endpoints actually called** — authorization, token exchange, userinfo,
  posts, image upload/register.
- **Env vars** it needs (none exist in `apps/api/.env.example` yet — a
  `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / redirect URL will be added).
- **Explicitly not supported (initially):** Company Pages (`linkedin_org`),
  video, carousel / multi-image.
- **Permalink URL caveat** — LinkedIn doesn't return a clean public post URL;
  the pattern in common use is unofficial and should be verified on use rather
  than trusted blindly.
- **`needs_reconnect` trigger condition** — when the stored token is rejected /
  expired and can't be refreshed, the `social_accounts` row flips to
  `needs_reconnect` and its `post_targets` are held.

## Prep doc

No LinkedIn preparation document currently lives in this repo. If one is
authored later (in `docs/` or the planning thread), link it here.
