# platforms/threads.md

**Status: real OAuth + publish, live.** As of 2026-09-03,
`apps/api/src/routes/oauth-threads.ts` and `apps/api/src/platforms/threads.ts`
are real. Its own app/credentials, its own OAuth entirely — separate from
both Facebook Login for Business and Instagram Login.

## Scope

Text-only or single-image. Video and carousel fail immediately
(`assertSupportedMedia`), same pattern as every other adapter.

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
  OAuth route has an equivalent identity call. Worth double-checking this
  exact endpoint shape against Meta's Threads API docs on first real
  connect.
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
