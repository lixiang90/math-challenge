#!/usr/bin/env node
/**
 * backfill-content.mjs — 把存量 projects.description（jsonb 多语正文）搬进
 * Storage 桶 project-content，并回填 content_path / content_locales。
 *
 * 配合 migration 0005（新增路径列）与 0006（删除 description 旧列）使用：
 *
 *   0005 加列  →  本脚本搬数据  →  0006 删列
 *
 * 只处理 content_path 为空的行，重复执行安全。
 *
 * 用法：
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *     node scripts/backfill-content.mjs [--dry-run]
 */

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const DRY = process.argv.includes("--dry-run");
const BUCKET = "project-content";

if (!url || !key) {
  console.error("需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(url, key, { auth: { persistSession: false } });

async function upload(path, body) {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "text/markdown; charset=utf-8",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${await res.text()}`);
}

const { data: rows, error } = await db
  .from("projects")
  .select("id, slug, description, content_path")
  .is("content_path", null);
if (error) throw error;

console.error(`待回填 ${rows.length} 个项目`);

for (const row of rows) {
  const desc = row.description || {};
  // en 是回退语种，缺失时用任意已有语种顶上，保证正文不丢
  const locales = ["en", "zh"].filter((l) => (desc[l] || "").trim());
  if (!locales.length) {
    const any = Object.entries(desc).find(([, v]) => (v || "").trim());
    if (any) {
      desc.en = any[1];
      locales.push("en");
    }
  }
  if (!locales.length) {
    console.error(`  跳过 ${row.slug}（正文为空）`);
    continue;
  }

  const contentPath = `projects/${row.slug}`;
  if (DRY) {
    console.error(`  [dry] ${row.slug} → ${contentPath}/{${locales.join(",")}}.md`);
    continue;
  }

  for (const l of locales) await upload(`${contentPath}/${l}.md`, desc[l]);

  const { error: ue } = await db
    .from("projects")
    .update({ content_path: contentPath, content_locales: locales })
    .eq("id", row.id);
  if (ue) throw new Error(`${row.slug}: ${ue.message}`);
  console.error(`  ✓ ${row.slug} → ${locales.join(", ")}`);
}

console.error("回填完成。");
