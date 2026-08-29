# PRODUCT.md — placeholder stub

> **This is an auto-generated stub.** The real `PRODUCT.md` was authored in the
> planning thread and should be dropped into `docs/brain/` to replace this file
> wholesale. Do not build this out in place — replace it.

## What we know from the repo in the meantime

- **Product name:** "The Social Queue" (repo/codename `richfeed`, npm scope
  `@richfeed/*`).
- **What it is:** a social media scheduling and multi-account publishing SaaS.
  Currently an internal tool for Blue Beacon Research (BBR); built multi-tenant
  from day one but launching single-tenant.
- **Core loop that exists today:** connect social accounts → compose a post
  (caption, hashtags, media) → target one or more accounts, each with its own
  schedule time and optional caption override → posts land in a queue → a
  worker publishes them at the scheduled time → per-target status and a
  publish-attempt log are shown back to the user.
- **Target platforms (from the schema's `platform` check constraint):**
  instagram, facebook, twitter, linkedin_personal, linkedin_org, tiktok,
  youtube, pinterest, threads, reddit.
- **Pages that exist:** Dashboard, Accounts, Compose, Post detail/edit,
  Calendar, Queue, Settings, plus auth (sign-in / sign-up / forgot-password).
  See `features/STATUS.md`.

See `DECISIONS.md` and `CHANGELOG.md` for how it got here.
