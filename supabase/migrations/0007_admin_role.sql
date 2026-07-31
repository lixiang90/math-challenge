-- 0007: site-wide admin role + official-content protection.
--
-- Design (see PLAN.md §P3 admin):
--   * Admin authority is an EXPLICIT role granted to a personal account,
--     decoupled from any GitHub handle. @math-challenge stays a login-less
--     bot/brand identity and holds NO admin rights.
--   * site_admins is auditable and supports multiple admins.
--   * Official / sync-imported content is flagged managed_by_sync and is
--     protected from deletion (only service_role / the sync script deletes it).
--   * The first admin(s) are seeded from INITIAL_ADMIN_LOGINS (handled in app
--     code via service_role); RLS forbids ordinary users from self-granting.

-- ---------------------------------------------------------------------------
-- 1. site_admins: explicit, auditable, multi-admin
-- ---------------------------------------------------------------------------
create table if not exists public.site_admins (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  granted_by  uuid        references auth.users (id),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create index if not exists site_admins_active_idx
  on public.site_admins (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- 2. is_site_admin(): called from other tables' RLS policies. Plays nicely with
--    site_admins' own RLS (which gates by auth.uid() = user_id) so there is no
--    recursion. Reads site_admins as the requesting role; returns true only if
--    that role is an active admin.
-- ---------------------------------------------------------------------------
create or replace function public.is_site_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.site_admins
    where user_id = auth.uid()
      and revoked_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS on site_admins: a user may only ever see/modify their OWN row; inserts
--    are forbidden via the API (with check (false)) so nobody can self-grant.
--    The first seed is written by app code using the service_role key, which
--    bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.site_admins enable row level security;

drop policy if exists "site_admins_self_read" on public.site_admins;
create policy "site_admins_self_read" on public.site_admins
  for select using (auth.uid() = user_id);

drop policy if exists "site_admins_self_write" on public.site_admins;
create policy "site_admins_self_write" on public.site_admins
  for update using (auth.uid() = user_id) with check (false);

drop policy if exists "site_admins_self_delete" on public.site_admins;
create policy "site_admins_self_delete" on public.site_admins
  for delete using (auth.uid() = user_id);

drop policy if exists "site_admins_no_insert" on public.site_admins;
create policy "site_admins_no_insert" on public.site_admins
  for insert with check (false);

-- ---------------------------------------------------------------------------
-- 4. projects.managed_by_sync: marks official / sync-imported content. Such
--    projects are delete-protected (only service_role may remove them).
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists managed_by_sync boolean not null default false;

-- ---------------------------------------------------------------------------
-- 5. projects RLS: admins can read every project (incl. drafts) and edit any
--    project; deletion is allowed for the owner OR an admin, but NEVER for a
--    managed_by_sync (official) project.
-- ---------------------------------------------------------------------------
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select using (
    status = 'published'
    or auth.uid() = owner_id
    or public.is_site_admin()
  );

drop policy if exists "projects_update_self" on public.projects;
create policy "projects_update_self" on public.projects
  for update using (
    auth.uid() = owner_id
    or auth.uid() in (
      select pm.user_id from public.project_members pm where pm.project_id = id
    )
    or public.is_site_admin()
  )
  with check (
    auth.uid() = owner_id
    or auth.uid() in (
      select pm.user_id from public.project_members pm where pm.project_id = id
    )
    or public.is_site_admin()
  );

drop policy if exists "projects_delete_self" on public.projects;
create policy "projects_delete_self" on public.projects
  for delete using (
    (auth.uid() = owner_id or public.is_site_admin())
    and not managed_by_sync
  );

-- ---------------------------------------------------------------------------
-- 6. challenge_problems: admins may write (edit official problem statements,
--    moderate) regardless of ownership.
-- ---------------------------------------------------------------------------
drop policy if exists "problems_write_owner" on public.challenge_problems;
create policy "problems_write_owner" on public.challenge_problems
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
    or public.is_site_admin()
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
    or public.is_site_admin()
  );

-- ---------------------------------------------------------------------------
-- 7. project_members: admins may remove maintainers (moderation).
-- ---------------------------------------------------------------------------
drop policy if exists "project_members_delete" on public.project_members;
create policy "project_members_delete" on public.project_members
  for delete using (
    auth.uid() = user_id
    or auth.uid() in (
      select p.owner_id from public.projects p where p.id = project_id
    )
    or public.is_site_admin()
  );

-- ---------------------------------------------------------------------------
-- 8. submissions: admins may read and update any submission (manual review /
--    verdict override), beyond the existing self/owner rules.
-- ---------------------------------------------------------------------------
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    auth.uid() = user_id
    or status = 'passed'
    or public.is_site_admin()
  );

drop policy if exists "submissions_update_self" on public.submissions;
create policy "submissions_update_self" on public.submissions
  for update using (
    auth.uid() = user_id
    or public.is_site_admin()
  )
  with check (
    auth.uid() = user_id
    or public.is_site_admin()
  );

-- ---------------------------------------------------------------------------
-- 9. Backfill: the 231 lean-eval imports are owned by the login-less
--    @math-challenge bot profile. Flag them as official / delete-protected.
--    Idempotent.
-- ---------------------------------------------------------------------------
update public.projects
set managed_by_sync = true
where owner_id = (
  select id from public.profiles where github_login = 'math-challenge'
)
and managed_by_sync is distinct from true;
