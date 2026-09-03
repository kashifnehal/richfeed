-- 0004_account_disconnected_status.sql
--
-- 1. 'disconnected' becomes a valid social_accounts.status so disconnecting
--    an account is a soft status change instead of a hard delete — post
--    history (post_targets / publish_attempts) stays intact. See
--    docs/brain/DECISIONS.md (2026-08-29, "Disconnect account is a hard
--    delete, for now") for why this was deferred until now.
-- 2. platform_username: the human-readable handle (e.g. X's @handle),
--    distinct from platform_account_id (the stable numeric id used in the
--    (user_id, platform, platform_account_id) uniqueness check) — needed to
--    build a real permalink URL for a published post.

alter table social_accounts
  drop constraint social_accounts_status_check;

alter table social_accounts
  add constraint social_accounts_status_check
  check (status in ('connected', 'needs_reconnect', 'limited', 'disconnected'));

alter table social_accounts
  add column platform_username text;
