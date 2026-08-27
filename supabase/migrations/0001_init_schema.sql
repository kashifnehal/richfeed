-- 0001_init_schema.sql
-- Core scheduling engine schema: social_accounts, scheduled_posts,
-- post_targets, publish_attempts — plus updated_at triggers and RLS.
--
-- Platform / PostTargetStatus / AccountStatus check constraints mirror
-- packages/shared/src/types.ts exactly. Keep them in sync if those types
-- change.

-- Needed for gen_random_uuid().
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- social_accounts
-- ---------------------------------------------------------------------

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  platform text not null check (
    platform in (
      'instagram',
      'facebook',
      'twitter',
      'linkedin_personal',
      'linkedin_org',
      'tiktok',
      'youtube',
      'pinterest',
      'threads',
      'reddit'
    )
  ),
  platform_account_id text not null,
  display_name text,
  avatar_url text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  status text not null default 'connected' check (
    status in ('connected', 'needs_reconnect', 'limited')
  ),
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, platform_account_id)
);

create trigger social_accounts_set_updated_at
  before update on social_accounts
  for each row
  execute function set_updated_at();

alter table social_accounts enable row level security;

create policy social_accounts_select_own on social_accounts
  for select
  using (user_id = auth.uid());

create policy social_accounts_insert_own on social_accounts
  for insert
  with check (user_id = auth.uid());

create policy social_accounts_update_own on social_accounts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy social_accounts_delete_own on social_accounts
  for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- scheduled_posts
-- ---------------------------------------------------------------------

create table scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  caption text,
  hashtags text[],
  media_urls text[],
  media_type text check (media_type in ('image', 'video', 'carousel')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scheduled_posts_set_updated_at
  before update on scheduled_posts
  for each row
  execute function set_updated_at();

alter table scheduled_posts enable row level security;

create policy scheduled_posts_select_own on scheduled_posts
  for select
  using (user_id = auth.uid());

create policy scheduled_posts_insert_own on scheduled_posts
  for insert
  with check (user_id = auth.uid());

create policy scheduled_posts_update_own on scheduled_posts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy scheduled_posts_delete_own on scheduled_posts
  for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- post_targets
-- ---------------------------------------------------------------------

create table post_targets (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id),
  publish_at timestamptz not null,
  platform_caption_override text,
  status text not null default 'pending' check (
    status in (
      'pending',
      'publishing',
      'published',
      'failed',
      'needs_reconnect',
      'queued'
    )
  ),
  platform_post_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger post_targets_set_updated_at
  before update on post_targets
  for each row
  execute function set_updated_at();

alter table post_targets enable row level security;

create policy post_targets_select_own on post_targets
  for select
  using (
    exists (
      select 1
      from scheduled_posts
      where scheduled_posts.id = post_targets.scheduled_post_id
        and scheduled_posts.user_id = auth.uid()
    )
  );

create policy post_targets_insert_own on post_targets
  for insert
  with check (
    exists (
      select 1
      from scheduled_posts
      where scheduled_posts.id = post_targets.scheduled_post_id
        and scheduled_posts.user_id = auth.uid()
    )
  );

create policy post_targets_update_own on post_targets
  for update
  using (
    exists (
      select 1
      from scheduled_posts
      where scheduled_posts.id = post_targets.scheduled_post_id
        and scheduled_posts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from scheduled_posts
      where scheduled_posts.id = post_targets.scheduled_post_id
        and scheduled_posts.user_id = auth.uid()
    )
  );

create policy post_targets_delete_own on post_targets
  for delete
  using (
    exists (
      select 1
      from scheduled_posts
      where scheduled_posts.id = post_targets.scheduled_post_id
        and scheduled_posts.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- publish_attempts
-- ---------------------------------------------------------------------

create table publish_attempts (
  id uuid primary key default gen_random_uuid(),
  post_target_id uuid not null references post_targets(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  http_status int,
  error_code text,
  error_message text,
  attempt_number int not null default 1
);

alter table publish_attempts enable row level security;

create policy publish_attempts_select_own on publish_attempts
  for select
  using (
    exists (
      select 1
      from post_targets
      join scheduled_posts on scheduled_posts.id = post_targets.scheduled_post_id
      where post_targets.id = publish_attempts.post_target_id
        and scheduled_posts.user_id = auth.uid()
    )
  );

create policy publish_attempts_insert_own on publish_attempts
  for insert
  with check (
    exists (
      select 1
      from post_targets
      join scheduled_posts on scheduled_posts.id = post_targets.scheduled_post_id
      where post_targets.id = publish_attempts.post_target_id
        and scheduled_posts.user_id = auth.uid()
    )
  );

create policy publish_attempts_update_own on publish_attempts
  for update
  using (
    exists (
      select 1
      from post_targets
      join scheduled_posts on scheduled_posts.id = post_targets.scheduled_post_id
      where post_targets.id = publish_attempts.post_target_id
        and scheduled_posts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from post_targets
      join scheduled_posts on scheduled_posts.id = post_targets.scheduled_post_id
      where post_targets.id = publish_attempts.post_target_id
        and scheduled_posts.user_id = auth.uid()
    )
  );

create policy publish_attempts_delete_own on publish_attempts
  for delete
  using (
    exists (
      select 1
      from post_targets
      join scheduled_posts on scheduled_posts.id = post_targets.scheduled_post_id
      where post_targets.id = publish_attempts.post_target_id
        and scheduled_posts.user_id = auth.uid()
    )
  );
