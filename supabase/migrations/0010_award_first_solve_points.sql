-- Award a problem's bonus exactly once per user on the first accepted
-- submission. The unique (user_id, problem_id) constraint on points_ledger is
-- the concurrency boundary; later accepted submissions receive zero points.

grant select, insert on public.points_ledger to service_role;
grant select on public.challenge_problems to service_role;

create or replace function private.award_first_solve_points()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  awarded_points integer;
begin
  if new.status = 'passed' and old.status is distinct from 'passed' then
    insert into public.points_ledger (
      user_id,
      problem_id,
      submission_id,
      delta,
      reason_key,
      reason_params,
      created_at
    )
    select
      new.user_id,
      new.problem_id,
      new.id,
      problem.bonus_points,
      'reasonFirstSolve',
      jsonb_build_object('bonus_points', problem.bonus_points),
      coalesce(new.finished_at, now())
    from public.challenge_problems as problem
    where problem.id = new.problem_id
    on conflict (user_id, problem_id) do nothing
    returning delta into awarded_points;

    new.points_awarded := coalesce(awarded_points, 0);
  end if;

  return new;
end;
$$;

revoke execute on function private.award_first_solve_points()
  from public, anon, authenticated;

drop trigger if exists submissions_award_first_solve on public.submissions;
create trigger submissions_award_first_solve
before update of status
on public.submissions
for each row execute function private.award_first_solve_points();

-- Backfill already accepted submissions deterministically. This also covers
-- the production smoke test that exposed the missing award hook.
insert into public.points_ledger (
  user_id,
  problem_id,
  submission_id,
  delta,
  reason_key,
  reason_params,
  created_at
)
select distinct on (submission.user_id, submission.problem_id)
  submission.user_id,
  submission.problem_id,
  submission.id,
  problem.bonus_points,
  'reasonFirstSolve',
  jsonb_build_object('bonus_points', problem.bonus_points),
  coalesce(submission.finished_at, submission.created_at)
from public.submissions as submission
join public.challenge_problems as problem on problem.id = submission.problem_id
where submission.status = 'passed'
order by
  submission.user_id,
  submission.problem_id,
  submission.finished_at nulls last,
  submission.created_at,
  submission.id
on conflict (user_id, problem_id) do nothing;

update public.submissions as submission
set points_awarded = ledger.delta
from public.points_ledger as ledger
where ledger.submission_id = submission.id
  and submission.points_awarded is distinct from ledger.delta;
