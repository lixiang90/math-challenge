-- =============================================================================
-- math-challenge — 初始 Schema 迁移 (P2-4)
-- 对齐 src/lib/types.ts 的全部字段；RLS 策略见文件末尾。
-- 在 Supabase Dashboard → SQL Editor 粘贴执行，或经 Supabase CLI 运行。
-- 执行顺序：建表 → 索引 → 触发器 → 自动建档 + 补档 → 启用 RLS + 策略
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 多语字段统一用 jsonb: {"en": "...", "zh": "..."}（en 为回退语言，必填）
-- -----------------------------------------------------------------------------

-- profiles：与 GitHub OAuth 用户一一对应，登录后由触发器自动建档
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  github_login  text unique not null,
  display_name  text not null,
  avatar_url    text,
  bio           jsonb,                       -- I18nText | null，可选
  total_points  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- projects：普通项目与 Challenge 项目共用一张表
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  type          text not null check (type in ('normal', 'challenge')),
  title         jsonb not null,              -- I18nText
  summary       jsonb not null,              -- I18nText
  description   jsonb not null,              -- I18nText，长文 Markdown
  repo_url      text not null,
  default_branch text not null default 'main',
  difficulty    text not null check (difficulty in ('intro', 'easy', 'medium', 'hard', 'research')),
  tags          text[] not null default '{}',
  status        text not null default 'published' check (status in ('draft', 'published', 'archived')),
  readme        jsonb,                       -- P5 预留：真实 README 抓取
  file_tree     jsonb,                       -- P5 预留：真实文件树抓取
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- challenge_problems：Challenge 项目下的题目
create table if not exists public.challenge_problems (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id) on delete cascade,
  slug                 text not null,
  order_index          integer not null default 0,
  title                jsonb not null,       -- I18nText
  statement            jsonb not null,       -- I18nText，题面 Markdown
  challenge_lean_path  text not null,        -- 仓库内 Challenge.lean 路径
  challenge_lean_source text not null default '',  -- 只读展示的 Lean 源码（P3 前由 seed 提供）
  solution_module      text not null,        -- comparator config.solution_module
  theorem_names        text[] not null default '{}',
  permitted_axioms     text[] not null default '{propext,Quot.sound,Classical.choice}',
  definition_names     text[] not null default '{}',
  enable_nanoda        boolean not null default false,
  bonus_points         integer not null default 0,
  deadline             timestamptz,
  status               text not null default 'open' check (status in ('open', 'closed')),
  unique (project_id, slug)
);

-- submissions：题目解答提交，验证结果由 P3 的 GitHub Actions 回写
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  problem_id     uuid not null references public.challenge_problems (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  repo_url       text not null,
  commit_sha     text not null,
  solution_path  text not null,
  status         text not null default 'queued'
                  check (status in ('queued', 'running', 'passed', 'failed', 'error', 'timeout', 'review')),
  verdict        jsonb,                      -- SubmissionVerdict | null
  log_url        text,
  runner_run_id  text,
  points_awarded integer not null default 0,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);

-- points_ledger：积分流水，仅 service role（P4 触发器 / 服务端）写入
create table if not exists public.points_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  problem_id    uuid not null references public.challenge_problems (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  delta         integer not null,
  reason_key    text not null check (reason_key in ('reasonFirstSolve')),
  reason_params jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  unique (user_id, problem_id)              -- 同题只首次通过计分
);

-- -----------------------------------------------------------------------------
-- 2. 索引（加速列表 / 个人中心 / 排行榜查询）
-- -----------------------------------------------------------------------------
create index if not exists projects_owner_id_idx      on public.projects (owner_id);
create index if not exists projects_status_idx        on public.projects (status);
create index if not exists problems_project_id_idx    on public.challenge_problems (project_id);
create index if not exists submissions_problem_id_idx on public.submissions (problem_id);
create index if not exists submissions_user_id_idx    on public.submissions (user_id);
create index if not exists ledger_user_id_idx         on public.points_ledger (user_id);

-- -----------------------------------------------------------------------------
-- 3. updated_at 自动维护
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. 登录后自动建档 + 存量用户补档
--    GitHub OAuth 经 Supabase Auth，raw_user_meta_data 含 user_name / name / avatar_url
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, github_login, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'user_name',
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'user_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 为 migration 执行前已注册、但 profiles 尚无记录的用户补档（幂等）
insert into public.profiles (id, github_login, display_name, avatar_url)
select
  u.id,
  u.raw_user_meta_data->>'user_name',
  coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'user_name'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
where u.raw_user_meta_data->>'user_name' is not null
  and not exists (select 1 from public.profiles p where p.id = u.id);

-- -----------------------------------------------------------------------------
-- 5. 启用 RLS
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.challenge_problems enable row level security;
alter table public.submissions       enable row level security;
alter table public.points_ledger     enable row level security;

-- -----------------------------------------------------------------------------
-- 6. RLS 策略
-- -----------------------------------------------------------------------------

-- profiles：公开可读；仅本人可改
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- 注意：insert 不开放给 anon/authenticated，仅由上面的 security definer 触发器写入

-- projects：公开只读已发布项；owner 可读写自己的（含草稿）
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select using (status = 'published' or auth.uid() = owner_id);

drop policy if exists "projects_insert_self" on public.projects;
create policy "projects_insert_self" on public.projects
  for insert with check (auth.uid() = owner_id);

drop policy if exists "projects_update_self" on public.projects;
create policy "projects_update_self" on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "projects_delete_self" on public.projects;
create policy "projects_delete_self" on public.projects
  for delete using (auth.uid() = owner_id);

-- challenge_problems：随项目可见性；仅项目 owner 可写
drop policy if exists "problems_select" on public.challenge_problems;
create policy "problems_select" on public.challenge_problems
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.status = 'published' or p.owner_id = auth.uid())
    )
  );

drop policy if exists "problems_write_owner" on public.challenge_problems;
create policy "problems_write_owner" on public.challenge_problems
  for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- submissions：本人可读全部；他人仅可读 passed 公开记录；仅本人可提交
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (auth.uid() = user_id or status = 'passed');

drop policy if exists "submissions_insert_self" on public.submissions;
create policy "submissions_insert_self" on public.submissions
  for insert with check (auth.uid() = user_id);

drop policy if exists "submissions_update_self" on public.submissions;
create policy "submissions_update_self" on public.submissions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- 注：P3 的 GitHub Actions 回写走 service_role（绕过 RLS）更新 status/verdict

-- points_ledger：仅本人可读；写入仅限 service_role（不开放给 anon/authenticated）
drop policy if exists "ledger_select_self" on public.points_ledger;
create policy "ledger_select_self" on public.points_ledger
  for select using (auth.uid() = user_id);
  -- 无 insert/update/delete 策略 → 默认拒绝，仅 service_role 可写（P4 触发器）
