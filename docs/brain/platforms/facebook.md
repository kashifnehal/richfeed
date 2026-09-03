# platforms/facebook.md

**Status: real OAuth + publish, live.** As of 2026-09-03,
`apps/api/src/routes/oauth-facebook.ts` and `apps/api/src/platforms/facebook.ts`
are real. Facebook Login for Business — genuinely separate app/OAuth flow
from Instagram (`platforms/instagram.md`), sharing only the `META_APP_ID` /
`META_APP_SECRET` naming (kept as `META_` rather than `FACEBOOK_` because
that's what the founder's existing dashboard setup notes call it).

## The one platform with a picker

Every other platform here (X, Instagram, Threads, LinkedIn whenever it
lands) is 1:1 — one OAuth grant, one connectable account. Facebook is the
exception: a user can administer several Pages, and one login returns all
of them. So the callback doesn't upsert straight into `social_accounts` —
it stashes the Page list server-side and hands the browser to a picker
screen instead.

## OAuth + the picker flow

- **Scopes**: `pages_show_list,pages_read_engagement,pages_manage_posts,business_management`.
- **Authorize**: `GET https://www.facebook.com/v26.0/dialog/oauth`.
- **Token exchange**: `GET https://graph.facebook.com/v26.0/oauth/access_token`
  — a **GET with query params**, not a POST body (different shape from
  X's/Instagram's/Threads' token endpoints — don't copy those call sites).
- **Long-lived exchange**: same endpoint, `grant_type=fb_exchange_token` —
  ~60 day user token.
- **List Pages**: `GET /me/accounts` with the long-lived user token →
  every Page the user administers, each with its own **Page access token**
  (obtained this way, these don't expire on the same clock as user
  tokens — treated as effectively non-expiring; no `refresh_token` concept,
  no `token_expires_at` stored for a Facebook account).
- **Pending state**: the Page list (id, name, Page token — encrypted with
  the same `lib/crypto.ts` used for DB storage even though this is
  transient) is stored in Redis via the new `lib/pending-store.ts` (10 min
  TTL, `SETEX`-backed — chosen over an in-process Map specifically because
  `tsx watch`'s dev-mode restarts would silently drop an in-memory pending
  connection mid-flow), keyed by a random id. The callback redirects to
  `/accounts/connect/facebook?pending=<id>` instead of straight back to
  `/accounts`.
- **Picker screen** (`apps/web/app/(dashboard)/accounts/connect/facebook/page.tsx`):
  fetches `GET /api/oauth/facebook/pending/:id` (a normal authenticated
  fetch — this page is already loaded in the browser, so the usual
  Authorization-header path applies, unlike `/start`/`/callback` which are
  top-level navigations with no header to read) to list the Pages,
  checkbox-selects, then `POST /api/oauth/facebook/confirm` with the
  selected ids. Only checked Pages get written to `social_accounts`
  (`platform='facebook'`), upserted on `(user_id, platform,
  platform_account_id)` same as every other platform's reconnect path. The
  pending record is deleted from Redis on confirm.
- **Session boundary**: same connect-ticket flow as every other platform
  now (`/start` takes `?ticket=`, not a raw access token) — see
  `platforms/x.md`'s "session-boundary problem" writeup. The picker's own
  `/pending/:id` and `/confirm` routes are unaffected — they're reached by
  a normal authenticated fetch from an already-loaded page, so the usual
  `Authorization` header applies there.
- **Env vars**: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`.
- **Known scaling limit**: the pending payload is one Redis value holding
  every Page's encrypted token — fine for the realistic case (a handful of
  Pages) but untested at a large Page count. Not worth a dedicated table for
  this stage (see `CLAUDE.md`'s "don't gold-plate" guidance) — flagged here
  rather than silently built around.

## Publish (no container step)

Uses `graph.facebook.com` with the **Page** access token from the picker,
never a user token.

- Text post: `POST /{page-id}/feed` with `message`. (The spec's "and link if
  present" case has no corresponding field in RichFeed's schema — no
  distinct "link" input exists in Compose today — so it's dropped rather
  than half-built.)
- Photo post: `POST /{page-id}/photos` with `url` (the post's Supabase
  Storage media URL) + `caption`.
- `platformPostId`: a photo response's `id` is the **photo object**, not
  the Page post — `post_id` (present on a photo response, absent on a plain
  feed response) is the actual post identifier; the adapter uses
  `post_id ?? id`.
- Permalink: `https://www.facebook.com/{post-id}` — a pattern, not fetched.
  Per the build spec's own caution, Meta's permalink conventions have
  shifted before; this hasn't been click-through verified against a real
  published post in this environment (no live browser here — see the
  report for what to check manually).

Video and carousel are out of scope, same rejection pattern as every other
adapter (`assertSupportedMedia`, checked before any network call).

## `needs_reconnect` trigger condition

Same Meta-family check as Instagram/Threads — see `platforms/meta-shared.ts`.
There's no refresh path for a Facebook Page token (no refresh_token to fall
back on), so any auth failure goes straight to `needs_reconnect`.
