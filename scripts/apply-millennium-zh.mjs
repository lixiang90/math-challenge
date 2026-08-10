// =============================================================================
// 为千禧年大奖问题项目补充中文说明。
//
// 机制（见 src/lib/project-content.ts）：
//   项目长文存在公开桶 `project-content` 的 `projects/<slug>/<locale>.md`。
//   仅上传 zh.md 不够 —— getProjectContent 靠 `content_locales` 字段判断是否
//   回退英文，所以必须同步把 'zh' 加进 content_locales，并补 title.zh / summary.zh。
//
// 用法（在本地、Supabase 可达的环境运行，仓库根目录）：
//   node scripts/apply-millennium-zh.mjs            # dry-run，只打印将写入的内容
//   node scripts/apply-millennium-zh.mjs --apply    # 真正上传 + 更新表
//
// 依赖：.env.local 里的 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY。
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ZH_DIR = join(HERE, "millennium-zh");
const BUCKET = "project-content";
const APPLY = process.argv.includes("--apply");

// 每个问题与：本地 md 文件、匹配关键字、卡片中文标题/摘要。
const PROBLEMS = [
  {
    key: "p-versus-np",
    file: "p-versus-np.md",
    keywords: ["p versus np", "p vs np", "p_versus_np", "p/np", " millennium_p_versus_np"],
    titleZh: "P 对 NP 问题",
    summaryZh: "理论计算机科学的中心问题：能被快速验证的问题，是否也能被快速求解？",
  },
  {
    key: "riemann-hypothesis",
    file: "riemann-hypothesis.md",
    keywords: ["riemann", " millennium_riemann_hypothesis"],
    titleZh: "黎曼猜想",
    summaryZh: "素数分布的核心猜想：黎曼 ζ 函数的所有非平凡零点是否都落在临界线上？",
  },
  {
    key: "poincare-conjecture",
    file: "poincare-conjecture.md",
    keywords: ["poincare", "poincaré", " millennium_poincare_conjecture"],
    titleZh: "庞加莱猜想",
    summaryZh: "三维拓扑的基石：单连通的三维闭流形是否必为三维球面？（已被佩雷尔曼证明）",
  },
  {
    key: "hodge-conjecture",
    file: "hodge-conjecture.md",
    keywords: ["hodge", " millennium_hodge_conjecture"],
    titleZh: "霍奇猜想",
    summaryZh: "代数几何核心猜想：复射影簇上的霍奇类是否都来自代数子簇？",
  },
  {
    key: "yang-mills",
    file: "yang-mills.md",
    keywords: ["yang", "yang-mills", " millennium_yang_mills"],
    titleZh: "杨-米尔斯存在性与质量间隙",
    summaryZh: "量子场论的数学奠基：杨-米尔斯理论是否存在且带有质量间隙？",
  },
  {
    key: "navier-stokes",
    file: "navier-stokes.md",
    keywords: ["navier", " millennium_navier_stokes"],
    titleZh: "纳维-斯托克斯方程的存在性与光滑性",
    summaryZh: "流体力学根基：三维纳维-斯托克斯方程是否始终存在光滑解？",
  },
  {
    key: "birch-swinnerton-dyer",
    file: "birch-swinnerton-dyer.md",
    keywords: ["birch", "swinnerton", " millennium_birch_swinnerton_dyer"],
    titleZh: "伯奇和斯温纳顿-戴尔猜想",
    summaryZh: "椭圆曲线的算术：其 L 函数在 s=1 的零点阶数是否等于有理点群的秩？",
  },
];
const GENERIC_TITLE_ZH = "千禧年大奖难题";
const GENERIC_SUMMARY_ZH =
  "克莱数学研究所公布的七道千禧年大奖问题，跨越理论计算机科学、数论、拓扑、代数几何与数学物理。";

function readMd(file) {
  return readFileSync(join(ZH_DIR, file), "utf8");
}

function classify(p) {
  const hay = [
    p.title?.en,
    p.repo_url,
    (p.tags || []).join(" "),
    p.slug,
  ]
    .join(" ")
    .toLowerCase();
  const matched = PROBLEMS.filter((pr) =>
    pr.keywords.some((k) => hay.includes(k))
  );
  if (matched.length === 1) return { mode: "single", problem: matched[0] };
  if (matched.length > 1) return { mode: "multi", problems: matched };
  if (
    hay.includes("millenni") ||
    hay.includes("clay") ||
    hay.includes("千禧") ||
    hay.includes("千")
  ) {
    return { mode: "all" };
  }
  return null;
}

function buildContent(cls) {
  if (cls.mode === "single") return readMd(cls.problem.file);
  const list = cls.mode === "all" ? PROBLEMS : cls.problems;
  return list.map((pr) => readMd(pr.file)).join("\n\n---\n\n");
}

function buildMeta(cls) {
  if (cls.mode === "single") {
    return { titleZh: cls.problem.titleZh, summaryZh: cls.problem.summaryZh };
  }
  return { titleZh: GENERIC_TITLE_ZH, summaryZh: GENERIC_SUMMARY_ZH };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（检查 .env.local）");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, slug, title, summary, content_path, content_locales, repo_url, tags")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("查询失败:", error.message);
    process.exit(1);
  }

  const targets = [];
  for (const p of projects || []) {
    const cls = classify(p);
    if (!cls) continue;
    if (!p.content_path) {
      console.warn(`⚠️  跳过 ${p.slug}：content_path 为空，无法定位 Storage 路径`);
      continue;
    }
    targets.push({ p, cls });
  }

  console.log(`\n发现 ${targets.length} 个千禧年相关项目：\n`);
  for (const { p, cls } of targets) {
    const meta = buildMeta(cls);
    const locales = Array.from(new Set([...(p.content_locales || ["en"]), "zh"]));
    const zhPath = `${p.content_path}/zh.md`;
    const titleWillChange = !p.title?.zh;
    const summaryWillChange = !p.summary?.zh;
    console.log(`• slug: ${p.slug}`);
    console.log(`    匹配: ${cls.mode === "single" ? cls.problem.key : cls.mode}`);
    console.log(`    Storage 写入: ${BUCKET}/${zhPath}  (upsert)`);
    console.log(`    content_locales: ${(p.content_locales || ["en"]).join(",")} → ${locales.join(",")}`);
    console.log(`    title.zh:  ${titleWillChange ? "新增 → " + meta.titleZh : "已存在，保留"}`);
    console.log(`    summary.zh: ${summaryWillChange ? "新增 → " + meta.summaryZh : "已存在，保留"}`);
    console.log("");
  }

  if (!APPLY) {
    console.log("以上为 dry-run，未写入任何数据。确认无误后加 --apply 执行。");
    return;
  }

  for (const { p, cls } of targets) {
    const meta = buildMeta(cls);
    const content = buildContent(cls);
    const locales = Array.from(new Set([...(p.content_locales || ["en"]), "zh"]));

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(`${p.content_path}/zh.md`, content, {
        contentType: "text/markdown; charset=utf-8",
        upsert: true,
      });
    if (upErr) {
      console.error(`✗ ${p.slug} 上传 zh.md 失败:`, upErr.message);
      continue;
    }

    const patch = { content_locales: locales };
    if (!p.title?.zh) patch.title = { ...(p.title || {}), zh: meta.titleZh };
    if (!p.summary?.zh) patch.summary = { ...(p.summary || {}), zh: meta.summaryZh };

    const { error: dbErr } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", p.id);
    if (dbErr) {
      console.error(`✗ ${p.slug} 更新表失败:`, dbErr.message);
      continue;
    }
    console.log(`✓ ${p.slug} 已写入中文说明`);
  }
  console.log("\n完成。前端有 ~5 分钟缓存（ISR 300s），稍后刷新即可看到中文。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
