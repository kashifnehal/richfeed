-- 0005_post_target_permalink.sql
--
-- Real permalink URL for a published target, fetched from the platform's
-- own API at publish time and stored, rather than reconstructed
-- client-side. X and Facebook have a guessable URL pattern, but Instagram
-- and Threads don't (Instagram's permalink uses an opaque shortcode
-- unrelated to the media id; Threads may omit it entirely for a
-- copyright-flagged post) — a uniform stored column lets every adapter
-- populate it the same way and the frontend just display it.

alter table post_targets add column permalink_url text;
