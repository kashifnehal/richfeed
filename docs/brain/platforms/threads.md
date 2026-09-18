# platforms/threads.md

**Status: real OAuth + publish, live.** As of 2026-09-03,
`apps/api/src/routes/oauth-threads.ts` and `apps/api/src/platforms/threads.ts`
are real. Its own app/credentials, its own OAuth entirely — separate from
both Facebook Login for Business and Instagram Login.

## Scope

Text-only, single-image, and carousel (2–20 image children). Video still
fails immediately (`assertSupportedMedia`). Threads' carousel field names
are close to Instagram's but not identical: children use `media_type=IMAGE`
+ `is_carousel_item=true` on `POST /{id}/threads`; the parent uses
`media_type=CAROUSEL` + `children` + `text` (not `caption`); publish is
still `/threads_publish` after the existing 30s wait. Confirmed against
Meta's Threads Posts docs 2026-09-18.

## OAuth

- **Scopes**: `threads_basic,threads_content_publish`.
- **Authorize**: `GET https://threads.net/oauth/authorize`.
- **Token exchange**: `POST https://graph.threads.net/oauth/access_token` —
  short-lived, **1 hour**.
- **Long-lived exchange**: `GET https://graph.threads.net/access_token`
  (`grant_type=th_exchange_token`) immediately after — **60 days**. No
  refresh-before-expiry job exists yet; a connected Threads account will
  silently need reconnecting once that clock runs out with nothing
  proactively warning the user. Flagged, not built — out of scope for this
  step per the build spec.
- **Identity**: `GET https://graph.threads.net/v1.0/me?fields=id,username` —
  **not in the original build spec**, added because `platform_account_id`
  and `display_name` need to come from somewhere and every other platform's
  OAuth route has an equivalent identity call. **Verified 2026-09-18** on
  first real connect: Graph returned `id=28901533789454916`,
  `username=richfeed_social`, `name` absent/null. Stored row
  (`social_accounts.id` `2fba13ce-…`, user `080faeb1-…`):
  `platform_account_id` and `platform_username`/`display_name` match those
  Graph fields; scopes `threads_basic,threads_content_publish`;
  `token_expires_at` ~60 days out (`2026-11-16`). Endpoint shape is
  correct.
- **Session boundary**: same connect-ticket flow as every other platform
  now — see `platforms/x.md`'s "session-boundary problem" writeup.
- **Env vars**: `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_REDIRECT_URI`.
- No picker — one Threads profile per grant, same as X and Instagram.

## Publish (container flow, mirrors Instagram)

1. `POST /{threads-user-id}/threads` — `media_type=TEXT` + `text` (truncated
   to 500 chars), or `media_type=IMAGE` + `image_url` + `text`.
2. **Wait ~30 seconds** after container creation before publishing — Meta's
   own stated guidance, built as a real `setTimeout` delay inside the
   adapter (so the BullMQ job just takes longer; nothing in the worker
   itself needed to change to accommodate this).
3. `POST /{threads-user-id}/threads_publish` with `creation_id` →
   `{id: <media-id>}`, the `platformPostId`.
4. `GET /{media-id}?fields=permalink` — **best-effort**, handled gracefully
   if absent (Meta's own docs note a copyright-flagged post may omit it) —
   a missing permalink doesn't fail an otherwise-successful publish.

Carousel (image-only children, 2–20): create each child with
`media_type=IMAGE` + `image_url` + `is_carousel_item=true` (no `text` on
children), then the parent with `media_type=CAROUSEL` + `children` +
`text`, then the same 30s wait and `/threads_publish` on the parent.
Meta allows mixed image/video children; compose still rejects mixed so
this path is images only. Host remains `graph.threads.net` (not
`graph.threads.com`).

Limits: text ≤500 chars (enforced via truncation), images JPEG/PNG ≤8MB
(**not** enforced client-side — a violation surfaces as a real Graph API
error).

## `needs_reconnect` trigger condition

Same Meta-family auth check as Instagram/Facebook — see
`platforms/meta-shared.ts`'s `buildMetaError` (HTTP 401/403, or `error.code
=== 190` / `error.type === "OAuthException"` in a 400 body).

## Known gap

No refresh-before-expiry job for the 60-day long-lived token — see the OAuth
section above. The right shape is probably a scheduled job re-exchanging any
Threads token within N days of `token_expires_at`, but building that job is
explicitly out of scope for this step.

## First live connect + publish (2026-09-18)

Founder completed Threads OAuth in their own browser (Instagram login
never passed to the agent). Production row:

- `social_accounts.id` `2fba13ce-d2a8-40e2-ae8e-34452f676ee4`
- `platform_account_id=28901533789454916`
- `platform_username` / `display_name=richfeed_social`
- `status=connected`, `connected_at=2026-09-17 20:55:54Z`

Text-only post from `richfeed.social` (`scheduled_posts` `f221b889-…`,
caption "RichFeed live publish check — Threads, 18 Sep 2026.
Reliability over features.", `publish_at` 21:01Z):

- `post_targets.id` `d9f0ca9a-…`
- `status=published` at 21:04:01Z (jitter + 30s container delay)
- `platform_post_id=18112795760325453`
- `permalink_url=https://www.threads.com/@richfeed_social/post/DdZyCi_AaHY`
  (present — not a copyright-omit case)
- `publish_attempts` #1 `http_status=201`
- worker log: `job d9f0ca9a-… completed` at 21:04:11Z

Graph `GET /{id}?fields=id,text,permalink,timestamp,username,media_type`
with the stored token: HTTP 200, `text` matches caption,
`username=richfeed_social`, `media_type=TEXT_POST`, same permalink.
Opened that URL without a Threads login: page title and thread body
show the caption on `@richfeed_social`, posted ~4 minutes earlier.
Anonymous curl of the same URL is 200 but JS-rendered (title "Threads")
— use Graph or a real browser, not raw curl, to read the body.
