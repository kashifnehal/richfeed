# platforms/instagram.md

**Status: real OAuth + publish, live.** As of 2026-09-03,
`apps/api/src/routes/oauth-instagram.ts` and `apps/api/src/platforms/instagram.ts`
are real. Genuinely separate from Facebook Pages (`platforms/facebook.md`) —
its own standalone Meta product ("Instagram API with Instagram Login"), own
App ID, own OAuth dialog, own tester-invite process. Do not merge these or
assume one Meta OAuth grant covers both (an earlier plan, doc 54, assumed
that; it doesn't hold for this app's actual Meta dashboard setup).

## Scope

Image or video, no caption-only post (Instagram requires media) and no
carousel. `platforms/instagram.ts`'s `assertSupportedMedia` rejects anything
else immediately, before any network call.

## OAuth

- **Scopes**: `instagram_business_basic,instagram_business_content_publish`.
- **Authorize**: `GET https://www.instagram.com/oauth/authorize`.
- **Token exchange**: `POST https://api.instagram.com/oauth/access_token` —
  **multipart/form-data**, not the `application/x-www-form-urlencoded` most
  OAuth token endpoints (X's included) use. Returns a short-lived
  (~1h) `access_token` + `user_id`.
- **Long-lived exchange**: `GET https://graph.instagram.com/access_token`
  (`grant_type=ig_exchange_token`) immediately after — ~60 day token, no
  separate refresh_token concept; the same token gets re-exchanged before it
  expires (no refresh job built yet, same caveat as Threads).
- **Identity**: `GET https://graph.instagram.com/v21.0/me?fields=id,username,account_type`.
  `account_type` gates the connect attempt — anything other than `BUSINESS`
  or `CREATOR` (i.e. `PERSONAL`) is rejected right there with
  `?error=instagram_personal_account`, never stored. A Personal account can
  authenticate fine but can never publish through this API, so storing it
  would just defer the failure to publish time with a worse error.
- **Env vars**: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
  `INSTAGRAM_REDIRECT_URI`.
- No picker — the authenticated IG professional account connects directly,
  one account per grant, same as X and Threads (unlike Facebook Pages).

## Publish (two-step container flow)

Verify the API host before touching this: publishes go through
**`graph.instagram.com`**, not `graph.facebook.com` (the latter is the older
Facebook-Login-for-Business-linked Instagram flow, which this app isn't
using — confirmed against Meta's current "Instagram API with Instagram
Login" docs at implementation time; re-verify if this ever looks like it's
returning unexpected errors, since Meta's docs for this specific product
line have moved before).

1. `POST /{ig-user-id}/media` — `image_url` or (`video_url` +
   `media_type=VIDEO`) + `caption` (truncated to 2,200 chars) → `{id: <container-id>}`.
2. Poll `GET /{container-id}?fields=status_code` until `FINISHED` (or
   `ERROR`/`EXPIRED`, which fails the target with a clear message) — images
   are near-instant but this polls at least once regardless, per spec,
   rather than assuming.
3. `POST /{ig-user-id}/media_publish` with `creation_id` → `{id: <ig-media-id>}`,
   the `platformPostId`.
4. `GET /{media-id}?fields=permalink` for the real URL — Instagram's
   permalink uses an opaque shortcode unrelated to the media id, so it can't
   be pattern-constructed the way X's or Facebook's can. Best-effort: a
   failed permalink fetch doesn't fail an otherwise-successful publish (see
   migration `0005_post_target_permalink.sql`).

Limits: caption ≤2,200 chars (enforced), images JPEG only (**not** enforced
— a violation surfaces as a real Graph API error rather than being caught
client-side).

## `needs_reconnect` trigger condition

Same as every Meta-family adapter — see `platforms/meta-shared.ts`'s
`buildMetaError`: a Graph API auth failure often comes back as HTTP 400 with
`error.code === 190` / `error.type === "OAuthException"`, not a plain
401/403, so the auth-failure check looks at both.

## Known caveats

- The multipart/form-data requirement on the token-exchange endpoint and the
  `graph.instagram.com` host were both called out explicitly in the build
  spec as things to verify against live docs rather than assume — done at
  implementation time, but this environment has no live browser to
  double-check against Meta's dashboard/docs during a real OAuth
  click-through, so treat both as worth a first-connect sanity check.
- No case turned up (or could be tested, without a real tester-invited
  account) where one Instagram login surfaces multiple connectable
  accounts — the "no picker needed" assumption is unverified against a real
  multi-account scenario.
