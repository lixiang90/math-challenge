-- 0009: online Lean submission pipeline.
--
-- Security invariants:
--   * browsers cannot insert or mutate verdict-bearing submission rows;
--   * untrusted Lean source lives in a private Storage bucket, not in Postgres;
--   * only a deliberately narrow, trigger-maintained solved table is public;
--   * at most one active submission exists per (user, problem).

-- ---------------------------------------------------------------------------
-- 1. Problem-side verifier metadata and pristine editor templates
-- ---------------------------------------------------------------------------
alter table public.challenge_problems
  add column if not exists verifier_problem_id text,
  add column if not exists submission_templates jsonb,
  add column if not exists submission_enabled boolean not null default false;

alter table public.challenge_problems
  drop constraint if exists challenge_problems_submission_templates_shape;
alter table public.challenge_problems
  add constraint challenge_problems_submission_templates_shape check (
    submission_templates is null
    or (
      jsonb_typeof(submission_templates) = 'object'
      and submission_templates ? 'Submission.lean'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Submission state and immutable payload provenance
-- ---------------------------------------------------------------------------
alter table public.submissions
  add column if not exists source_kind text not null default 'inline',
  add column if not exists payload_path text,
  add column if not exists solution_digest text,
  add column if not exists verifier_problem_id text,
  add column if not exists benchmark_commit text,
  add column if not exists dispatch_attempt integer not null default 0,
  add column if not exists queued_at timestamptz not null default now(),
  add column if not exists callback_received_at timestamptz,
  add column if not exists error_message text;

-- The original P2 schema required repo fields. Inline submissions do not use
-- them; repo ingestion remains a later adapter over the same verifier.
alter table public.submissions
  alter column repo_url drop not null,
  alter column commit_sha drop not null,
  alter column solution_path drop not null;

alter table public.submissions
  drop constraint if exists submissions_source_kind_check,
  drop constraint if exists submissions_payload_shape,
  drop constraint if exists submissions_digest_shape,
  drop constraint if exists submissions_dispatch_attempt_check;

alter table public.submissions
  add constraint submissions_source_kind_check
    check (source_kind in ('inline', 'repo')),
  add constraint submissions_payload_shape check (
    (source_kind = 'inline' and payload_path is not null)
    or
    (source_kind = 'repo' and repo_url is not null
      and commit_sha is not null and solution_path is not null)
  ),
  add constraint submissions_digest_shape check (
    solution_digest is null or solution_digest ~ '^[0-9a-f]{64}$'
  ),
  add constraint submissions_dispatch_attempt_check
    check (dispatch_attempt >= 0);

create unique index if not exists submissions_one_active_per_user_problem
  on public.submissions (user_id, problem_id)
  where status in ('queued', 'running');

create index if not exists submissions_user_created_idx
  on public.submissions (user_id, created_at desc);
create index if not exists submissions_queued_idx
  on public.submissions (queued_at, id)
  where status = 'queued';

-- ---------------------------------------------------------------------------
-- 3. RLS: the browser may read its own rows, but all writes go through the
--    authenticated Next.js route and its server-only service role client.
-- ---------------------------------------------------------------------------
drop policy if exists "submissions_insert_self" on public.submissions;
drop policy if exists "submissions_update_self" on public.submissions;
drop policy if exists "submissions_select" on public.submissions;

create policy "submissions_select_own_or_admin" on public.submissions
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.is_site_admin())
  );

-- Public pages need solver counts, not source coordinates, verdicts, or logs.
-- Do not use an owner-executed view here: Postgres views bypass the underlying
-- table's RLS unless they are security_invoker, while a security-invoker view
-- would require granting public access to the sensitive submissions table.
create table if not exists public.solved_submissions (
  id uuid primary key references public.submissions(id) on delete cascade,
  problem_id uuid not null references public.challenge_problems(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'passed' check (status = 'passed'),
  created_at timestamptz not null,
  finished_at timestamptz
);

create index if not exists solved_submissions_problem_id_idx
  on public.solved_submissions (problem_id);
create index if not exists solved_submissions_user_id_idx
  on public.solved_submissions (user_id);

alter table public.solved_submissions enable row level security;
drop policy if exists "solved_submissions_public_read" on public.solved_submissions;
create policy "solved_submissions_public_read" on public.solved_submissions
  for select to anon, authenticated
  using (true);

revoke all on public.solved_submissions from public, anon, authenticated;
grant select on public.solved_submissions to anon, authenticated;
-- The status-sync trigger runs in the caller's context. Server-side writes use
-- the service role, so grant only the DML it needs explicitly instead of
-- relying on Supabase's legacy default table grants.
grant select, insert, update, delete on public.solved_submissions to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_solved_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'passed' then
    insert into public.solved_submissions (
      id, problem_id, user_id, status, created_at, finished_at
    ) values (
      new.id, new.problem_id, new.user_id, 'passed', new.created_at, new.finished_at
    )
    on conflict (id) do update set
      problem_id = excluded.problem_id,
      user_id = excluded.user_id,
      finished_at = excluded.finished_at;
  else
    delete from public.solved_submissions where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_solved_submission()
  from public, anon, authenticated;

drop trigger if exists submissions_sync_solved on public.submissions;
create trigger submissions_sync_solved
after insert or update of status, problem_id, user_id, finished_at
on public.submissions
for each row execute function private.sync_solved_submission();

-- Backfill any existing passed rows before the trigger existed.
insert into public.solved_submissions (
  id, problem_id, user_id, status, created_at, finished_at
)
select id, problem_id, user_id, 'passed', created_at, finished_at
from public.submissions
where status = 'passed'
on conflict (id) do update set
  problem_id = excluded.problem_id,
  user_id = excluded.user_id,
  finished_at = excluded.finished_at;

-- ---------------------------------------------------------------------------
-- 4. Private payload/log buckets. service_role bypasses Storage RLS; there are
--    deliberately no anon/authenticated object policies for these buckets.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('submission-payloads', 'submission-payloads', false, 1572864,
    array['application/json']::text[]),
  ('submission-logs', 'submission-logs', false, 1048576,
    array['application/json', 'text/plain']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- project-content is already a public bucket. A duplicate objects SELECT
-- policy enables object listing and is unnecessary for public downloads.
drop policy if exists "project_content_public_read" on storage.objects;

-- ---------------------------------------------------------------------------
-- 5. Harden existing helper functions flagged by Supabase's security advisor.
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = '';
alter function public.is_site_admin() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Missing FK indexes reported by the database advisor.
create index if not exists points_ledger_problem_id_idx
  on public.points_ledger (problem_id);
create index if not exists points_ledger_submission_id_idx
  on public.points_ledger (submission_id);
create index if not exists site_admins_granted_by_idx
  on public.site_admins (granted_by)
  where granted_by is not null;
