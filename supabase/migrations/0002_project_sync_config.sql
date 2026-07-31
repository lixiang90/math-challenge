-- =============================================================================
-- math-challenge — P2-6 项目创建/编辑表单：Challenge 项目的同步配置
-- 在 Supabase Dashboard → SQL Editor 粘贴执行（在 0001 之后）。
-- 普通(Normal)项目只填整个仓库；Challenge 项目可额外指定：
--   sync_commit  → 固定到某个 commit（为空则同步时取最新 commit）
--   sync_branch  → 同步分支（为空则用 default_branch）
--   sync_path    → 仓库内相对路径（为空则根目录）
-- 三者对 Normal 项目无意义，留空即可。
-- =============================================================================

alter table public.projects
  add column if not exists sync_commit text,
  add column if not exists sync_branch text,
  add column if not exists sync_path   text;

comment on column public.projects.sync_commit is
  'Challenge 项目：固定同步的 commit SHA；为空表示同步时取最新 commit。';
comment on column public.projects.sync_branch is
  'Challenge 项目：同步分支；为空表示使用 default_branch。';
comment on column public.projects.sync_path is
  'Challenge 项目：仓库内相对路径；为空表示仓库根目录。';
