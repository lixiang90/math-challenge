-- =============================================================================
-- 0006: 删除已外置的行内正文列。
--
-- 前置条件：先跑 scripts/backfill-content.mjs 把 projects.description 搬进
-- Storage 桶 project-content 并回填 content_path / content_locales，否则正文会丢。
--
--   description  → 已拆成 <content_path>/{en,zh}.md
--   readme       → P5 预留列，从未写入过；真实 README 现在由 GitHub 实时拉取，
--                  项目正文由 Storage 提供，这一列没有存在意义
--   file_tree    → 同为 P5 预留，改为 GitHub git-trees API 实时拉取 + 进程内缓存，
--                  不再落库（缓存一份陈旧的树反而容易和仓库不一致）
-- =============================================================================

do $$
begin
  if exists (
    select 1 from public.projects
    where content_path is null and description is not null
  ) then
    raise exception '仍有项目未回填 content_path，请先运行 scripts/backfill-content.mjs';
  end if;
end $$;

alter table public.projects
  drop column if exists description,
  drop column if exists readme,
  drop column if exists file_tree;
