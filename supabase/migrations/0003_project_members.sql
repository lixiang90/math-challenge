-- 0003: multi-maintainer support via "claim".
--
-- A project has exactly one owner (projects.owner_id) plus zero or more
-- maintainers recorded in project_members. Claiming a project grants edit
-- rights when the claimer's GitHub login matches the repo's GitHub owner.
-- Projects created through the form are owned by the submitter, so they are
-- "auto-claimed" (the submitter is the owner and can edit immediately).

create table if not exists public.project_members (
  project_id uuid        not null references public.projects (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  role       text        not null default 'maintainer'
                          check (role in ('maintainer', 'admin')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

comment on table public.project_members is
  'Users who can edit/maintain a project in addition to its owner. Gained via claim.';

create index if not exists project_members_user_idx
  on public.project_members (user_id);

alter table public.project_members enable row level security;

-- Logged-in users may see who maintains a project.
drop policy if exists "project_members_select" on public.project_members;
create policy "project_members_select" on public.project_members
  for select using (auth.uid() is not null);

-- A user may only insert themselves. The ownership check (GitHub login ==
-- repo owner) is enforced in application code before this is called.
drop policy if exists "project_members_insert_self" on public.project_members;
create policy "project_members_insert_self" on public.project_members
  for insert with check (auth.uid() = user_id);

-- A member may leave; the project owner may remove any member.
drop policy if exists "project_members_delete" on public.project_members;
create policy "project_members_delete" on public.project_members
  for delete using (
    auth.uid() = user_id
    or auth.uid() in (
      select p.owner_id from public.projects p where p.id = project_id
    )
  );

-- projects: owner OR any maintainer may update. Deletion stays owner-only.
drop policy if exists "projects_update_self" on public.projects;
create policy "projects_update_self" on public.projects
  for update using (
    auth.uid() = owner_id
    or auth.uid() in (
      select pm.user_id
      from public.project_members pm
      where pm.project_id = id
    )
  )
  with check (
    auth.uid() = owner_id
    or auth.uid() in (
      select pm.user_id
      from public.project_members pm
      where pm.project_id = id
    )
  );
