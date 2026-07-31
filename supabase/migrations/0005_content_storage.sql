-- =============================================================================
-- 0005: 长正文外置到 Supabase Storage，数据表只保留路径。
--
-- 背景
--   projects.description 原本是 jsonb {"en": "...", "zh": "..."}，直接把整篇
--   Markdown 正文塞在行里。批量导入 lean-eval 的挑战项目后，单行会膨胀到几 KB，
--   而列表页 select * 会把所有正文一起拉下来，纯属浪费。
--
-- 方案
--   正文按语种拆成独立文件放进公开桶 `project-content`：
--       projects/<slug>/en.md
--       projects/<slug>/zh.md
--   表里只留：
--       content_path     对象前缀，如 'projects/my-slug'（不含语种与扩展名）
--       content_locales  实际存在哪些语种，如 '{en}' / '{en,zh}'
--   有了 content_locales，前端判断"该内容暂无中文版本"不需要额外发一次
--   HEAD 请求探测文件是否存在。
--
--   短字段（title / summary）刻意保留在表内 jsonb：列表页要靠它们做筛选、
--   排序和搜索，外置会让每张卡片都多一次文件读取。
--
-- 兼容
--   本迁移只做加法，description 列暂时保留；等回填脚本把存量正文搬进桶里，
--   再由 0006 删除旧列。
-- =============================================================================

-- 1. 公开桶：正文可免鉴权直读，配合 CDN 缓存
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-content', 'project-content', true, 5242880)
on conflict (id) do update set public = true;

-- 2. 读策略：任何人可读该桶；写入只走 service_role（绕过 RLS），不开放策略
drop policy if exists "project_content_public_read" on storage.objects;
create policy "project_content_public_read"
  on storage.objects for select
  using (bucket_id = 'project-content');

-- 3. projects 新增路径字段
alter table public.projects
  add column if not exists content_path text,
  add column if not exists content_locales text[] not null default '{}'::text[];

comment on column public.projects.content_path is
  'Storage 对象前缀，如 projects/<slug>；实际文件为 <prefix>/<locale>.md';
comment on column public.projects.content_locales is
  '该项目正文实际存在的语种，用于免探测地判断是否有译文';

-- 4. 清理上一轮试验遗留的 readme_path 列
--    （空桶 challenge-readmes 需走 Storage API 删除，Postgres 侧禁止直删 storage.buckets）
alter table public.projects drop column if exists readme_path;

-- 5. 按 content_path 查项目的索引（同步脚本回查用）
create index if not exists projects_content_path_idx
  on public.projects (content_path);
