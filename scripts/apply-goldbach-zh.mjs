// =============================================================================
// 为 math-challenge 中的「哥德巴赫猜想」(slug: goldbach_conjecture) 补充中文说明。
//
// 机制（见 src/lib/project-content.ts）：
//   项目长文存在公开桶 `project-content` 的 `projects/<slug>/<locale>.md`。
//   仅上传 zh.md 不够 —— getProjectContent 靠 `content_locales` 字段判断是否
//   回退英文，所以必须同步把 'zh' 加进 content_locales，并补 title.zh / summary.zh。
//
// 注意：哥德巴赫猜想不是千禧年大奖问题，故单独成脚本，不混入 apply-millennium-zh。
//
// 用法（在本地、Supabase 可达的环境运行，仓库根目录）：
//   node scripts/apply-goldbach-zh.mjs            # dry-run，只打印将写入的内容
//   node scripts/apply-goldbach-zh.mjs --apply    # 真正上传 + 更新表
//
// 依赖：.env.local 里的 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY。
// 前置：先跑 sync-lean-eval.mjs 把 goldbach_conjecture 项目创建/同步进数据库。
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ZH_FILE = join(HERE, "goldbach-zh.md");
const BUCKET = "project-content";
const SLUG = "goldbach_conjecture";
const APPLY = process.argv.includes("--apply");

const TITLE_ZH = "哥德巴赫猜想（非千禧年大奖问题）";
const SUMMARY_ZH =
  "哥德巴赫猜想的强偶数形式：每个大于 2 的偶数都可表示为两个素数之和。作为著名的未解难题收录于此；它不属于克莱数学研究所的七道千禧年大奖问题。";

// Node 不会自动读取 .env.local（那是 Next.js 的约定）。在读取密钥前手动加载，
// 避免用户必须加 --env-file 才能运行。仅当变量尚未设置时才填充，避免覆盖。
function loadEnvLocal() {
  try {
    const envPath = join(HERE, "..", ".env.local");
    const text = readFileSync(envPath, "utf8");
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const name = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (name && process.env[name] === undefined) process.env[name] = value;
    }
  } catch {
    /* 文件不存在则跳过，后续仍会因缺变量报错 */
  }
}
loadEnvLocal();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（检查 .env.local）");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, slug, title, summary, content_path, content_locales")
    .eq("slug", SLUG)
    .maybeSingle();
  if (error) {
    console.error("查询失败:", error.message);
    process.exit(1);
  }
  if (!project) {
    console.error(`未找到 slug=${SLUG} 的项目。请先运行 sync-lean-eval.mjs 把它同步进数据库。`);
    process.exit(1);
  }
  if (!project.content_path) {
    console.error(`⚠️  ${SLUG} 的 content_path 为空，无法定位 Storage 路径。`);
    process.exit(1);
  }

  const md = readFileSync(ZH_FILE, "utf8");
  const locales = Array.from(new Set([...(project.content_locales || ["en"]), "zh"]));
  const zhPath = `${project.content_path}/zh.md`;
  const titleWillChange = !project.title?.zh;
  const summaryWillChange = !project.summary?.zh;

  console.log(`\n目标项目: ${project.slug}`);
  console.log(`  Storage 写入: ${BUCKET}/${zhPath}  (upsert)`);
  console.log(`  content_locales: ${(project.content_locales || ["en"]).join(",")} → ${locales.join(",")}`);
  console.log(`  title.zh:  ${titleWillChange ? "新增 → " + TITLE_ZH : "已存在，保留"}`);
  console.log(`  summary.zh: ${summaryWillChange ? "新增 → " + SUMMARY_ZH : "已存在，保留"}`);
  console.log(`  md 字符数: ${md.length}`);

  if (!APPLY) {
    console.log("\n以上为 dry-run，未写入任何数据。确认无误后加 --apply 执行。");
    return;
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(zhPath, md, { contentType: "text/markdown; charset=utf-8", upsert: true });
  if (upErr) {
    console.error(`✗ 上传 zh.md 失败:`, upErr.message);
    process.exit(1);
  }

  const patch = { content_locales: locales };
  if (titleWillChange) patch.title = { ...(project.title || {}), zh: TITLE_ZH };
  if (summaryWillChange) patch.summary = { ...(project.summary || {}), zh: SUMMARY_ZH };

  const { error: dbErr } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", project.id);
  if (dbErr) {
    console.error(`✗ 更新表失败:`, dbErr.message);
    process.exit(1);
  }
  console.log("\n✓ goldbach_conjecture 已写入中文说明。前端有 ~5 分钟缓存（ISR 300s），稍后刷新即可看到中文。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
