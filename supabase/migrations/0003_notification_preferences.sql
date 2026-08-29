-- 0003_notification_preferences.sql
-- Per-user notification preferences for the Settings > Notifications page.
-- Persists the toggles only — actual email/push delivery is out of scope
-- (the app has no email provider wired). NotificationBell reads these to
-- decide what to surface in-app.

create table notification_preferences (
  user_id uuid primary key references auth.users(id),
  notify_on_failed_post boolean not null default true,
  notify_on_needs_reconnect boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on notification_preferences
  for each row
  execute function set_updated_at();

alter table notification_preferences enable row level security;

create policy notification_preferences_select_own on notification_preferences
  for select
  using (user_id = auth.uid());

create policy notification_preferences_insert_own on notification_preferences
  for insert
  with check (user_id = auth.uid());

create policy notification_preferences_update_own on notification_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
