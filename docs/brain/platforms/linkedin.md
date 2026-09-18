# platforms/linkedin.md

**Status: real OAuth + publish, live.** As of 2026-09-03,
`apps/api/src/routes/oauth-linkedin.ts` and `apps/api/src/platforms/linkedin.ts`
are real. Personal-profile posting only — no review gate, self-serve app
credentials. Company Pages (`linkedin_org`) remain deliberately deferred
(see `platforms/STATUS.md`).

## Scope

Text-only, single-image, and carousel (organic `content.multiImage`, 2–20
images). Video still fails immediately (`assertSupportedMedia`). LinkedIn's
sponsored Carousel API (`content.carousel` + `adContext`) is a different
product and is not used — confirmed against the MultiImage API docs
(view `li-lms-2026-08`).

## OAuth

- **Scopes**: `openid profile w_member_social`.
- **Authorize**: `GET https://www.linkedin.com/oauth/v2/authorization`.
- **Token exchange**: `POST https://www.linkedin.com/oauth/v2/accessToken`,
  `application/x-www-form-urlencoded`. **LinkedIn's self-serve
  personal-profile OAuth doesn't reliably return a `refresh_token`** —
  handled as optional/absent throughout (`UpsertSocialAccountInput`'s
  `refreshTokenEncrypted` is nullable for exactly this kind of case). There
  is no refresh path in the adapter as a result — an expired/invalid token
  goes straight to `needs_reconnect`.
- **Identity**: `GET https://api.linkedin.com/v2/userinfo` → `{ sub, name,
  picture }`. `sub` is the member id; the author URN used on every publish
  call is `urn:li:person:{sub}`.
- **Session boundary**: same connect-ticket flow as every other platform
  (`/start` takes `?ticket=`, not a raw access token) — see the writeup in
  this file's sibling docs / `lib/oauth-state.ts`.
- **Env vars**: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
  `LINKEDIN_REDIRECT_URI`, `LINKEDIN_API_VERSION` (LinkedIn versions its
  REST API monthly, `YYYYMM`, and expects every request to pin one — set to
  `202608` in this environment's `.env` as of this writing; confirm that's
  still within LinkedIn's supported range before relying on it, since the
  supported window rolls forward).

## Publish

`POST https://api.linkedin.com/rest/posts`, headers `Authorization: Bearer
{token}`, `X-Restli-Protocol-Version: 2.0.0`, `LinkedIn-Version:
{LINKEDIN_API_VERSION}`.

- Text-only body: `{ author, commentary, visibility: "PUBLIC", distribution:
  { feedDistribution: "MAIN_FEED", targetEntities: [],
  thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED",
  isReshareDisabledByAuthor: false }`.
- Single image: first `POST
  https://api.linkedin.com/rest/images?action=initializeUpload` with `{
  initializeUploadRequest: { owner: authorUrn } }` → `{ value: { uploadUrl,
  image } }`; fetch the image bytes from its Supabase Storage URL, `PUT`
  them to `uploadUrl`, then include `content: { media: { id: image } }` in
  the same `/rest/posts` body above.
- Carousel / multi-image: same `uploadImage()` once per URL (2–20), then
  `content: { multiImage: { images: [{ id: urn }, ...] } }` instead of
  `content.media.id`. `altText` is optional in the API; RichFeed does not
  currently store per-image alt text so it is omitted.
- Success: `201`, the post URN comes back in the **`x-restli-id` response
  header** (not the body) — that's the `platformPostId`.
- Permalink: `https://www.linkedin.com/feed/update/{platformPostId}/` — a
  pattern, not fetched. **Not a pattern LinkedIn formally documents.**
  **Click-through verified 2026-09-18** against a real published post (does
  **not** 404; resolves to the right post). `platformPostId` is the share
  URN from `x-restli-id` (e.g. `urn:li:share:7506448322102996993`). Guest
  view of that URL showed author **Rich Feed**, heading "Rich Feed's
  Post", and the exact caption. LinkedIn also 302s the same URN to a
  `/posts/rich-feed-…-activity-{activityId}-…` vanity URL; both are the
  same post. Earlier Sept 5 publish
  `urn:li:share:7502128201083551745` ("post2 [RichFeed]") resolves the
  same way. Treat a future 404 as unexpected now, not "expected-possible."

**Carousel live-verified 2026-09-18:** `post_target` `aab015ee-…`
`status=published`, `platform_post_id=urn:li:ugcPost:7506637615413153792`
(ugcPost, not share — MultiImage uses ugcPost), permalink
`https://www.linkedin.com/feed/update/urn:li:ugcPost:7506637615413153792/`.
Guest view: author **Rich Feed**, caption, two-image carousel `1 / 2`.

## `needs_reconnect` trigger condition

401/403 from any LinkedIn call. No refresh path exists (see OAuth section
above), so any auth failure here is terminal until the user reconnects.
