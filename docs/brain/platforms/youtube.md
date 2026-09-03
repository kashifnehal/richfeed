# platforms/youtube.md

**Status: real OAuth + publish, live.** As of 2026-09-03,
`apps/api/src/routes/oauth-youtube.ts` and `apps/api/src/platforms/youtube.ts`
are real.

## Scope

**Video only** — an `instagram`/`facebook`-shaped image post targeting a
YouTube account fails immediately (`assertSupportedMedia`: "YouTube only
supports video posts"), the inverse of every other platform's video
rejection.

## OAuth

- **Scope**: `https://www.googleapis.com/auth/youtube.upload`.
- **Authorize**: `GET https://accounts.google.com/o/oauth2/v2/auth` with
  `access_type=offline&prompt=consent` — both required to reliably get a
  `refresh_token` back; Google only issues one on first consent otherwise.
  If a reconnect ever happens without `prompt=consent` re-triggering and
  Google omits the refresh token, the callback fails clearly
  (`?error=youtube_connect_failed`) rather than storing an account that can
  never refresh.
- **Token exchange**: standard `POST https://oauth2.googleapis.com/token`,
  `authorization_code` grant.
- **Identity**: `GET
  https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`.
  **Deviation from the build spec**: the spec allowed falling back to a
  placeholder display name if `youtube.upload` alone doesn't permit this
  call, without blocking connect. In practice there's no other endpoint
  that returns a stable channel id — without one there's nothing to set
  `platform_account_id` to, so this call is treated as required, not
  best-effort; only the *display name/thumbnail* fall back to a placeholder
  if the snippet fields are somehow empty. If `youtube.upload` genuinely
  can't read channel info in practice, connect will fail here and that's a
  real finding to revisit, not something to silently work around.
- **Session boundary**: same connect-ticket flow as every other platform
  (`/start` takes `?ticket=`, not a raw access token).
- **Env vars**: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`,
  `YOUTUBE_REDIRECT_URI`. **Google requires an exact string match on the
  redirect URI, no wildcards** — confirm
  `http://localhost:4000/api/oauth/youtube/callback` is actually registered
  in the Google Cloud Console credentials screen for this OAuth client
  before testing; this wasn't verifiable from this environment (no console
  access).

## Publish (resumable upload)

- Refreshes the access token first if `token_expires_at` has passed
  (`POST https://oauth2.googleapis.com/token`, `grant_type=refresh_token`).
  Google doesn't rotate the refresh token the way X does, but the adapter
  re-persists whatever comes back regardless, per spec.
- `POST
  https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
  headers `X-Upload-Content-Length` / `X-Upload-Content-Type`, JSON body
  `{ snippet: { title, description, categoryId: "22" }, status: {
  privacyStatus: "private", publishAt } }`. `title` is derived from the
  caption's first line, truncated to 100 chars; `description` is caption +
  hashtags joined (added `hashtags` to the shared `PublishPost` adapter
  type for this — the only adapter that needed it so far).
  **`privacyStatus` MUST be `"private"`** (not `"unlisted"`) for
  `publishAt` scheduling to actually work — YouTube flips it public at that
  exact moment. If `publishAt` is already in the past when this runs,
  YouTube publishes immediately, which is expected, not a bug.
- The init response's `Location` header is the upload session URL — a
  single `PUT` of the full video body goes there (chunked upload is only
  for unreliable connections per Google's current guidance, not the
  default path here).
- Success: `id` in the response is the `platformPostId`. Permalink:
  `https://www.youtube.com/watch?v={id}`.

## `needs_reconnect` trigger condition

401/403 from any YouTube/Google call.
