# platforms/x.md

**Status: real OAuth + publish, live.** As of 2026-09-03, `apps/api/src/routes/oauth-x.ts`,
`apps/api/src/platforms/x.ts`, and the Accounts page's "X (Twitter)" connect button
are real — a user can connect a real X account and a real post goes out. This
was the first platform integration built (LinkedIn's credentials were still
pending on the founder's side), so it established the conventions every future
platform (`platforms/<name>.ts`, `routes/oauth-<name>.ts`, worker dispatch,
Accounts connect button) is expected to reuse.

## Scope

Text-only and single-image only. X also supports video, but that needs the
chunked INIT/APPEND/FINALIZE media upload flow, which is out of scope here —
a target whose `scheduled_posts.media_type` is `video` or `carousel` fails
immediately with a plain-language error (`platforms/x.ts`'s
`assertSupportedMedia`, checked before any network call), rather than
attempting a call that would only partially work.

## OAuth

Authorization Code + PKCE (S256), confidential client (client secret +
Basic auth on the token exchange, since a plain public/PKCE-only client
isn't enough for X's confidential-app requirements).

- **Scopes**: `tweet.write tweet.read users.read media.write offline.access`.
  `media.write` is easy to miss — plain-text posting works without it, but
  image upload 403s silently. `offline.access` is what makes X return a
  `refresh_token` (access tokens otherwise expire after 2h and force
  re-auth).
- **Endpoints**: `GET https://x.com/i/oauth2/authorize` (consent),
  `POST https://api.x.com/2/oauth2/token` (code exchange, and again for
  `grant_type=refresh_token`), `GET https://api.x.com/2/users/me` (identity —
  `id`, `username`, `name`; `username` is what the permalink URL is built
  from).
- **Env vars**: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI` (see
  `apps/api/.env.example`).

### The session-boundary problem this flow had to solve

`GET /api/oauth/x/start` is reached by a real full-page browser navigation
from the Accounts page (it has to be — X's consent screen only renders if the
browser actually leaves the SPA), so there's no `Authorization` header to
read the way every other route reads one. The obvious fallback — "read the
Supabase session cookie" — doesn't work either: the web app's `@supabase/ssr`
session cookie is scoped to the web app's own origin (`localhost:3000`), and
this API is a different origin (`localhost:4000`); it's never sent here.

The fix: the Accounts page reads its own Supabase session client-side and
appends the access token as `?access_token=` on the navigation to `/start`.
`/start` verifies it once (`getUserFromAccessToken`, factored out of
`requireUser` in `lib/auth.ts` for exactly this reuse) and carries the
resulting user id through the same short-lived httpOnly cookie that holds the
PKCE state/verifier (`lib/oauth-state.ts`) across the redirect round-trip to
X and back, so `/callback` never needs a live session of its own. Known
trade-off: the access token briefly appears in the API's request URL (and
therefore its request log) for that one navigation — acceptable for a
local-only, no-real-users-yet tool (see `CLAUDE.md`), worth revisiting before
any real deployment.

`frontendOrigin()` in `oauth-x.ts` is hardcoded to `http://localhost:3000`
rather than read from `NEXT_PUBLIC_APP_URL` — that env var is already set in
this environment's `.env` to a future production domain
(`richfeed.social`) unrelated to local dev, and using it as-is would have
silently redirected every successful/failed connect attempt off of
localhost. Matches the CORS origin, which is hardcoded the same way in
`server.ts`.

## Endpoints called for publish (`platforms/x.ts`)

- `POST https://api.x.com/2/media/upload` — one-shot (non-chunked) multipart
  upload for the single image case; returns a media id.
- `POST https://api.x.com/2/tweets` — `{"text": "..."}`, or
  `{"text": "...", "media": {"media_ids": ["<id>"]}}` with an image attached.
  `201`, `data.id` is the platform post id.
- `POST https://api.x.com/2/oauth2/token` (`grant_type=refresh_token`) —
  called by the adapter itself, before publishing, whenever the stored
  `token_expires_at` has passed. X rotates the refresh token on every use, so
  the adapter persists the new access/refresh pair back
  (`updateSocialAccountTokens`) every time it refreshes.

## Permalink

`https://x.com/{username}/status/{platformPostId}` — real and stable, unlike
LinkedIn's (see `platforms/linkedin.md`). `username` comes from the identity
call at connect time and is stored on `social_accounts.platform_username`
(migration `0004_account_disconnected_status.sql`), separate from
`platform_account_id` (X's numeric user id, which doesn't change if the user
renames their handle, and is what the `(user_id, platform,
platform_account_id)` uniqueness constraint keys on). The frontend helper is
`apps/web/lib/permalink.ts`'s `buildPermalinkUrl` — returns `undefined` for
every platform besides `twitter`, which is what keeps the Post-detail
permalink icon inert for everything else.

## `needs_reconnect` trigger condition

`platforms/types.ts`'s `PlatformPublishError` carries an `isAuthFailure` flag.
The adapter sets it on a 401/403 from any X call, or when a stored token has
no `refresh_token` to fall back on. The worker (`queue/worker.ts`) checks that
flag: on an auth failure it flips the account to `needs_reconnect`
(`markSocialAccountNeedsReconnect`) in addition to failing the target; on any
other failure it just fails the target with the real error attached.
