-- Safe first-phase RLS rollout for the journal app.
-- Public content continues to flow through service-role-backed API routes
-- and server loaders. Direct browser access is limited to the small set of
-- tables that truly need authenticated client reads.

begin;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_profile_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.approved
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    false
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_approved()
    and public.current_profile_role() = 'owner'
$$;

create or replace function public.is_editorial_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_approved()
    and public.current_profile_role() in ('owner', 'admin', 'editor', 'reviewer')
$$;

create or replace function public.can_manage_editorial_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_approved()
    and public.current_profile_role() in ('owner', 'admin', 'editor')
$$;

create or replace function public.can_access_manuscript(target_manuscript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_editorial_staff()
    or exists (
      select 1
      from public.manuscripts m
      where m.id = target_manuscript_id
        and (m.author_id = auth.uid() or m.submitter_id = auth.uid())
    )
$$;

alter table if exists public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (id = auth.uid());

alter table if exists public.manuscripts enable row level security;
drop policy if exists manuscripts_select_author_or_staff on public.manuscripts;
create policy manuscripts_select_author_or_staff
on public.manuscripts
for select
using (
  public.is_editorial_staff()
  or author_id = auth.uid()
  or submitter_id = auth.uid()
);

alter table if exists public.manuscript_versions enable row level security;
drop policy if exists manuscript_versions_select_related_author_or_staff on public.manuscript_versions;
create policy manuscript_versions_select_related_author_or_staff
on public.manuscript_versions
for select
using (public.can_access_manuscript(manuscript_id));

alter table if exists public.manuscript_reviews enable row level security;
drop policy if exists manuscript_reviews_select_reviewer_or_staff on public.manuscript_reviews;
create policy manuscript_reviews_select_reviewer_or_staff
on public.manuscript_reviews
for select
using (
  public.is_editorial_staff()
  or reviewer_id = auth.uid()
);

alter table if exists public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
using (user_id = auth.uid());
create policy notifications_update_own
on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table if exists public.site_content enable row level security;
drop policy if exists site_content_owner_select on public.site_content;
drop policy if exists site_content_owner_insert on public.site_content;
drop policy if exists site_content_owner_update on public.site_content;
drop policy if exists site_content_owner_delete on public.site_content;
create policy site_content_owner_select
on public.site_content
for select
using (public.is_owner());
create policy site_content_owner_insert
on public.site_content
for insert
with check (public.is_owner());
create policy site_content_owner_update
on public.site_content
for update
using (public.is_owner())
with check (public.is_owner());
create policy site_content_owner_delete
on public.site_content
for delete
using (public.is_owner());

-- The rest of these tables are now expected to be reached through
-- service-role-backed server routes/loaders only.
alter table if exists public.site_files enable row level security;
alter table if exists public.issues enable row level security;
alter table if exists public.articles enable row level security;
alter table if exists public.editorial_board enable row level security;
alter table if exists public.advisory_board enable row level security;
alter table if exists public.cms_pages enable row level security;
alter table if exists public.admin_access_requests enable row level security;
alter table if exists public.admin_invites enable row level security;

commit;
