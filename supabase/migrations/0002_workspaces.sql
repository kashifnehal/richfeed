-- 0002_workspaces.sql
-- Promotes "workspace name" from a value stashed on auth.users.user_metadata
-- (a Step-3 stopgap) to a real table, so workspace-level settings have
-- somewhere to live. Still single-tenant in practice — one workspace per user,
-- owned by that user — but shaped for multi-tenant later.

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_owner_user_id_idx on workspaces (owner_user_id);

create trigger workspaces_set_updated_at
  before update on workspaces
  for each row
  execute function set_updated_at();

alter table workspaces enable row level security;

-- A user can see and rename the workspace(s) they own. Creation is automatic
-- (the auth.users trigger below) and deletion isn't a product feature, so no
-- insert/delete policy is exposed — the service-role API and the SECURITY
-- DEFINER trigger are the only writers of those.
create policy workspaces_select_own on workspaces
  for select
  using (owner_user_id = auth.uid());

create policy workspaces_update_own on workspaces
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Auto-create one workspace per new auth user.
-- Named from user_metadata.workspace_name if the sign-up flow set it,
-- else the email local-part, else a generic fallback.
-- ---------------------------------------------------------------------

create or replace function handle_new_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspaces (name, owner_user_id)
  values (
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'My Workspace'
    ),
    new.id
  );
  return new;
end;
$$;

create trigger on_auth_user_created_create_workspace
  after insert on auth.users
  for each row
  execute function handle_new_user_workspace();

-- ---------------------------------------------------------------------
-- Backfill: one workspace for every existing user that doesn't have one,
-- preserving whatever name is currently in their user_metadata.
-- ---------------------------------------------------------------------

insert into workspaces (name, owner_user_id)
select
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'workspace_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'My Workspace'
  ),
  u.id
from auth.users u
where not exists (
  select 1 from workspaces w where w.owner_user_id = u.id
);
