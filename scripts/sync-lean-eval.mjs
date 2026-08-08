#!/usr/bin/env node
/**
 * sync-lean-eval.mjs — 把 leanprover/lean-eval 的 `generated/*` 挑战题导入
 * Math-Challenge 数据库，可随时重跑做增量更新。
 *
 * `generated/` 下每个子文件夹是一道 comparator 格式的挑战：
 *   README.md       → 项目正文（存 Storage）+ 人类可读标题 + 出处/备注
 *   config.json     → solution_module / theorem_names / permitted_axioms / nanoda
 *   holes.json      → 待证命题的 Lean 形式化语句
 *   Challenge.lean  → 只读的可信声明文件，题目页展示
 *
 * 一个子文件夹 = 一个 Challenge 项目 + 一道题。
 *
 * 整仓一次性下载为 .tar.gz 后在内存里解析（零依赖的 ustar 读取器）：
 * 1 个 HTTP 请求而不是 900 多个，永远不会触发 GitHub 限流，可以随便重跑。
 *
 * ---------------------------------------------------------------------------
 * 用法
 * ---------------------------------------------------------------------------
 *   # 只解析、不写库，打印统计（先跑这个确认解析正常）
 *   node scripts/sync-lean-eval.mjs --dry-run
 *
 *   # 直接同步进 Supabase（正文上传 Storage + upsert 数据表）
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *     node scripts/sync-lean-eval.mjs
 *
 *   # 导出到磁盘：SQL 分片 + 正文文件，供 Dashboard / MCP 分批加载
 *   node scripts/sync-lean-eval.mjs --emit .cache/lean-eval
 *
 * 选项
 *   --dry-run          只解析并打印统计，不做任何写入
 *   --emit <dir>       导出 <dir>/sql/NNN.sql 与 <dir>/content/<slug>/en.md
 *   --chunk <n>        每个 SQL 分片包含多少个项目（默认 12）
 *   --limit <n>        只处理前 n 个子文件夹（冒烟测试用）
 *   --tarball <path>   读本地 tar.gz，跳过下载（离线调试）
 *   --repo <owner/name> 数据来源仓库（默认 leanprover/lean-eval）
 *   --branch <name>     数据来源默认分支（默认 main）
 *   --tag <tag>         给所有导入项目附加一个标签
 *   --prune            仓库中已删除的题目在库中标记为 archived
 *
 * 环境变量
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   直连模式凭证
 *   OWNER_GITHUB_LOGIN                         项目归属账号（默认 math-challenge）
 *   HTTPS_PROXY / HTTP_PROXY                   走代理下载 tarball
 */

import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const REPO = "leanprover/lean-eval";
const BRANCH = "main";
const GEN = "generated/";
const REPO_URL = `https://github.com/${REPO}`;
const TARBALL_URL = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}`;
const BUCKET = "project-content";
const TAGS = ["lean-eval", "comparator", "lean4"];
/** 平台机器人账号，批量导入的项目都挂在它名下 */
const DEFAULT_OWNER_LOGIN = "math-challenge";
const DEFAULT_OWNER_ID = "00000000-0000-0000-0000-0000000000a1";

const MAX_SUMMARY = 220;
/** 基准题给的积分；test problem 只是流程自检，象征性给一点 */
const POINTS_RESEARCH = 100;
const POINTS_TEST = 10;

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const DRY_RUN = has("--dry-run");
const EMIT_DIR = argOf("--emit");
const VERIFIER_ONLY = has("--verifier-only");
const CHUNK = Number(argOf("--chunk") || 12);
const LIMIT = Number(argOf("--limit") || 0);
const TARBALL = argOf("--tarball");
const PRUNE = has("--prune");
// Safety gate: syncing templates must not make every problem live by accident.
const ENABLE_SUBMISSIONS = has("--enable-submissions");
const SYNC_REPO = argOf("--repo") || REPO;
const SYNC_BRANCH = argOf("--branch") || BRANCH;
const EXTRA_TAG = argOf("--tag");
const SYNC_REPO_URL = `https://github.com/${SYNC_REPO}`;
const SYNC_TAGS = [...TAGS, ...(EXTRA_TAG ? [EXTRA_TAG] : [])];

const log = (...a) => console.error(...a);

// 代理（仅在显式设置时启用，undici 缺失则静默跳过）
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
// A ProxyAgent keeps Node's event loop alive. Local-tarball imports never need it.
if (PROXY && !TARBALL) {
  try {
    const { setGlobalDispatcher, ProxyAgent } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(PROXY));
    log(`[proxy] ${PROXY}`);
  } catch {
    log(`[proxy] 已设置 ${PROXY} 但 undici 不可用，直连重试`);
  }
}

// ---------------------------------------------------------------------------
// 极简 tar(ustar) 读取器 —— 返回 Map<路径, Buffer>
// ---------------------------------------------------------------------------
function readTar(buf) {
  const files = new Map();
  let off = 0;
  const str = (b, s, n) => {
    const slice = b.subarray(s, s + n);
    const z = slice.indexOf(0);
    return slice.subarray(0, z === -1 ? slice.length : z).toString("utf8");
  };
  while (off + 512 <= buf.length) {
    const hdr = buf.subarray(off, off + 512);
    if (hdr.every((b) => b === 0)) break; // 归档结束标记
    let name = str(hdr, 0, 100);
    const size = parseInt(str(hdr, 124, 12).trim(), 8) || 0;
    const type = String.fromCharCode(hdr[156]) || "0";
    const prefix = str(hdr, 345, 155);
    if (prefix) name = `${prefix}/${name}`;
    off += 512;
    if (type === "0" || type === "\0") files.set(name, buf.subarray(off, off + size));
    off += Math.ceil(size / 512) * 512;
  }
  return files;
}

// ---------------------------------------------------------------------------
// 数学分类（源自 LeanEval manifests/problems/<id>.toml 的 module 字段）
// ---------------------------------------------------------------------------
/**
 * 把 LeanEval 分类名 slug 化：Algebra -> algebra，NumberTheory -> number-theory。
 * 与 gen-category-tags.mjs 保持一致，保证同步写入与补丁 SQL 用同一套标签值。
 */
function slugifyCat(cat) {
  return cat
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * 解析 manifests/problems/<id>.toml，提取每个 problem 的数学分类。
 * 分类 = module 字段 `LeanEval.<分类>.<Name>` 的第二段；
 * 根目录的 EasyProblems.lean（two_plus_two 等自检题）归到 easy-problems。
 * 返回 Map<problemId, categorySlug>。
 */
function parseManifestCategories(files) {
  const map = new Map();
  for (const [path, buf] of files) {
    const m = path.match(/lean-eval-main\/manifests\/problems\/(.+)\.toml$/);
    if (!m) continue;
    const id = m[1];
    const modLine = buf.toString("utf8").match(/^module\s*=\s*"([^"]+)"/m);
    if (!modLine) continue;
    const segs = modLine[1].split(".");
    if (segs[0] !== "LeanEval") continue;
    if (segs.length === 2 && segs[1] === "EasyProblems") {
      map.set(id, "easy-problems");
      continue;
    }
    if (segs.length < 3) continue;
    map.set(id, slugifyCat(segs[1]));
  }
  return map;
}

// ---------------------------------------------------------------------------
// 解析
// ---------------------------------------------------------------------------
/**
 * lean-eval 的 README 结构固定：
 *
 *   # `problem_id`
 *   人类可读标题
 *   - Problem ID: `problem_id`
 *   - Test Problem: no
 *   - Submitter: ...
 *   - Notes / Source / Informal solution: ...
 *   <关于 Challenge.lean / Submission.lean / lake test 的公共样板文字>
 *
 * 样板段落对所有题目完全相同，抽出来当项目正文毫无信息量，因此从
 * "Do not modify" 起整段丢弃，只保留标题 + 字段 + 题目自有正文。
 */
function parseReadme(md) {
  const lines = md.split("\n");
  let title = "";
  const fields = {};
  let curKey = null;
  const bodyLines = [];
  let inBoilerplate = false;

  for (const raw of lines) {
    const l = raw.trimEnd();
    const t = l.trim();
    if (/^Do not modify /.test(t)) inBoilerplate = true;
    if (inBoilerplate) continue;
    if (t.startsWith("#")) continue;

    const m = t.match(/^- ([A-Za-z][A-Za-z ]*?):\s*(.*)$/);
    if (m) {
      curKey = m[1].trim().toLowerCase();
      fields[curKey] = m[2].trim();
      continue;
    }
    if (curKey && t && !t.startsWith("-")) {
      fields[curKey] += " " + t; // 上一字段的续行
      continue;
    }
    if (!title && t && !t.startsWith("-")) {
      title = t.replace(/`/g, "");
      continue;
    }
    bodyLines.push(l);
  }
  return { title, fields, body: bodyLines.join("\n").trim() };
}

function clamp(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function sourcePathFromMetadata(source) {
  const match = String(source || "").match(
    /^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/[^/]+\/(.+)$/,
  );
  return match?.[1];
}

/** 组装存进 Storage 的项目正文（Markdown）。 */
function buildContent(name, meta, holes, config) {
  const f = meta.fields;
  const out = [`# ${meta.title || name}`, ""];
  const sourceLabel = SYNC_REPO === REPO ? "lean-eval" : SYNC_REPO;
  out.push(
    `\`${name}\` — a formalization challenge imported from [${sourceLabel}](${SYNC_REPO_URL}) in lean-eval comparator format.`,
    "",
  );

  if (f.notes) out.push("## Notes", "", f.notes, "");
  if (meta.body) out.push(meta.body, "");

  const hole = holes?.holes?.[0];
  if (hole?.body) {
    out.push("## Formal statement", "", "```lean", hole.body.trim(), "```", "");
  }
  if (f["informal solution"]) {
    out.push("## Informal solution sketch", "", f["informal solution"], "");
  }
  if (f.source) out.push("## Source", "", f.source, "");

  out.push("## How to submit", "");
  out.push(
    "`Challenge.lean` and `Solution.lean` are part of the trusted benchmark and must not be modified.",
    "Write your proof in `Submission.lean` (plus any local modules under `Submission/`).",
    "Mathlib may be used freely; anything not in Mathlib has to be inlined into the submission.",
    ""
  );

  const cfgBits = [];
  if (config?.solution_module) cfgBits.push(`- Solution module: \`${config.solution_module}\``);
  if (config?.theorem_names?.length)
    cfgBits.push(`- Theorems checked: ${config.theorem_names.map((t) => `\`${t}\``).join(", ")}`);
  if (config?.permitted_axioms?.length)
    cfgBits.push(`- Permitted axioms: ${config.permitted_axioms.map((t) => `\`${t}\``).join(", ")}`);
  if (config?.enable_nanoda) cfgBits.push("- `nanoda` kernel replay: enabled");
  if (cfgBits.length) out.push("## Comparator configuration", "", ...cfgBits, "");

  if (f.submitter) out.push(`_Submitted by ${f.submitter}._`, "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** 题面：比项目正文更聚焦，只讲这道题要证什么。 */
function buildStatement(name, meta, holes) {
  const f = meta.fields;
  const parts = [];
  if (meta.title) parts.push(`**${meta.title}**`, "");
  if (f.notes) parts.push(f.notes, "");
  const hole = holes?.holes?.[0];
  if (hole?.body) parts.push("### Formal statement", "", "```lean", hole.body.trim(), "```", "");
  if (f["informal solution"]) parts.push("### Informal solution sketch", "", f["informal solution"], "");
  if (f.source) parts.push("### Source", "", f.source, "");
  const s = parts.join("\n").trim();
  return s || `Challenge \`${name}\`.`;
}

function collect(files, categoryById = new Map()) {
  const byName = new Map();
  for (const [path, buf] of files) {
    const i = path.indexOf(`/${GEN}`);
    if (i === -1) continue;
    const rest = path.slice(i + 1 + GEN.length); // "<name>/<file...>"
    const slash = rest.indexOf("/");
    if (slash === -1) continue;
    const name = rest.slice(0, slash);
    const file = rest.slice(slash + 1);
    if (!byName.has(name)) byName.set(name, {});
    const e = byName.get(name);
    if (file === "README.md") e.readme = buf.toString("utf8");
    else if (file === "config.json") e.config = buf.toString("utf8");
    else if (file === "holes.json") e.holes = buf.toString("utf8");
    else if (file === "Challenge.lean") e.challenge = buf.toString("utf8");
    else if (file === "Submission.lean" || /^Submission\/(?:[^/]+\/)*[^/]+\.lean$/.test(file)) {
      e.submissionTemplates ||= {};
      e.submissionTemplates[file] = buf.toString("utf8");
    }
  }

  const out = [];
  const skipped = [];
  for (const [name, e] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!e.readme) {
      skipped.push(name);
      continue;
    }
    const meta = parseReadme(e.readme);
    let config = {};
    let holes = null;
    try {
      config = e.config ? JSON.parse(e.config) : {};
    } catch {
      /* 配置损坏时退回默认值 */
    }
    try {
      holes = e.holes ? JSON.parse(e.holes) : null;
    } catch {
      /* holes.json 可选 */
    }

    const title = meta.title || name.replace(/_/g, " ");
    const isTest = /^y/i.test(meta.fields["test problem"] || "no");
    out.push({
      name,
      // 子文件夹名就是 comparator 的 problem id，全仓唯一且大小写敏感，
      // 直接当 slug 可以让 URL 与题目 ID 一一对应，同步时也不用维护映射表。
      slug: name,
      title,
      summary: clamp(meta.fields.notes || meta.body || title, MAX_SUMMARY),
      content: buildContent(name, meta, holes, config),
      statement: buildStatement(name, meta, holes),
      challengeSource: e.challenge || "",
      isTest,
      difficulty: isTest ? "intro" : "research",
      bonusPoints: isTest ? POINTS_TEST : POINTS_RESEARCH,
      syncPath: sourcePathFromMetadata(meta.fields.source) || `${GEN}${name}`,
      // 数学分类标签（来自 LeanEval manifests 的 module 字段），与通用标签合并
      category: categoryById.get(name) || undefined,
      tags: isTest
        ? [...SYNC_TAGS, "test-problem", ...(categoryById.get(name) ? [categoryById.get(name)] : [])]
        : [...SYNC_TAGS, ...(categoryById.get(name) ? [categoryById.get(name)] : [])],
      solutionModule: config.solution_module || "Solution",
      theoremNames: config.theorem_names || [],
      permittedAxioms: config.permitted_axioms || ["propext", "Quot.sound", "Classical.choice"],
      definitionNames: config.definition_names || [],
      enableNanoda: Boolean(config.enable_nanoda),
      verifierProblemId: name,
      submissionTemplates: e.submissionTemplates || {},
      submissionEnabled:
        ENABLE_SUBMISSIONS && Boolean(e.submissionTemplates?.["Submission.lean"]),
    });
  }
  return { items: out, skipped };
}

// ---------------------------------------------------------------------------
// SQL 生成（用于 --emit）
// ---------------------------------------------------------------------------
/** 美元引用字面量 —— 任意 Markdown / Lean 源码都能安全嵌入。 */
function dq(s) {
  return `$mc$${String(s).replace(/\$mc\$/g, "$ mc $")}$mc$`;
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (a) => (a.length ? `ARRAY[${a.map(q).join(",")}]::text[]` : `'{}'::text[]`);
const i18n = (en) => `${dq(JSON.stringify({ en }))}::jsonb`;

function projectSql(p, ownerId) {
  const syncPath = p.syncPath;
  const contentPath = `projects/${p.slug}`;
  return `-- ${p.name}
INSERT INTO public.projects
  (slug, owner_id, type, title, summary, repo_url, default_branch, sync_branch,
   sync_path, difficulty, tags, status, content_path, content_locales,
   managed_by_sync)
VALUES (${q(p.slug)}, ${q(ownerId)}, 'challenge',
  ${i18n(p.title)}, ${i18n(p.summary)}, ${q(SYNC_REPO_URL)}, ${q(SYNC_BRANCH)}, ${q(SYNC_BRANCH)},
  ${q(syncPath)}, ${q(p.difficulty)}, ${arr(p.tags)}, 'published',
  ${q(contentPath)}, ARRAY['en']::text[], true)
ON CONFLICT (slug) DO UPDATE SET
  type = EXCLUDED.type, title = EXCLUDED.title, summary = EXCLUDED.summary,
  repo_url = EXCLUDED.repo_url, default_branch = EXCLUDED.default_branch,
  sync_branch = EXCLUDED.sync_branch,
  sync_path = EXCLUDED.sync_path, difficulty = EXCLUDED.difficulty,
  tags = EXCLUDED.tags, status = EXCLUDED.status,
  content_path = EXCLUDED.content_path,
  content_locales = EXCLUDED.content_locales,
  managed_by_sync = EXCLUDED.managed_by_sync, updated_at = now();

INSERT INTO public.challenge_problems
  (project_id, slug, order_index, title, statement, challenge_lean_path,
   challenge_lean_source, solution_module, theorem_names, permitted_axioms,
   definition_names, enable_nanoda, bonus_points, status, verifier_problem_id,
   submission_templates, submission_enabled)
VALUES ((SELECT id FROM public.projects WHERE slug = ${q(p.slug)}), ${q(p.name)}, 1,
  ${i18n(p.title)}, ${i18n(p.statement)},
  ${q(`${GEN}${p.name}/Challenge.lean`)}, ${dq(p.challengeSource)},
  ${q(p.solutionModule)}, ${arr(p.theoremNames)}, ${arr(p.permittedAxioms)},
  ${arr(p.definitionNames)}, ${p.enableNanoda}, ${p.bonusPoints}, 'open',
  ${q(p.verifierProblemId)}, ${dq(JSON.stringify(p.submissionTemplates))}::jsonb,
  ${p.submissionEnabled})
ON CONFLICT (project_id, slug) DO UPDATE SET
  title = EXCLUDED.title, statement = EXCLUDED.statement,
  challenge_lean_path = EXCLUDED.challenge_lean_path,
  challenge_lean_source = EXCLUDED.challenge_lean_source,
  solution_module = EXCLUDED.solution_module,
  theorem_names = EXCLUDED.theorem_names,
  permitted_axioms = EXCLUDED.permitted_axioms,
  definition_names = EXCLUDED.definition_names,
  enable_nanoda = EXCLUDED.enable_nanoda,
  bonus_points = EXCLUDED.bonus_points,
  verifier_problem_id = EXCLUDED.verifier_problem_id,
  submission_templates = EXCLUDED.submission_templates,
  submission_enabled = EXCLUDED.submission_enabled;
`;
}

function verifierMetadataSql(p) {
  const templates = p.submissionTemplates?.["Submission.lean"]
    ? `${dq(JSON.stringify(p.submissionTemplates))}::jsonb`
    : "null";
  return `-- ${p.name}
UPDATE public.challenge_problems AS cp
SET verifier_problem_id = ${q(p.verifierProblemId)},
    submission_templates = ${templates},
    submission_enabled = false
FROM public.projects AS project
WHERE cp.project_id = project.id
  AND cp.slug = ${q(p.name)}
  AND project.slug = ${q(p.slug)}
  AND project.managed_by_sync = true
  AND 'lean-eval' = ANY(project.tags);
`;
}

function pruneSql(slugs) {
  return `-- 仓库中已不存在的 lean-eval 题目下架
UPDATE public.projects SET status = 'archived', updated_at = now()
WHERE 'lean-eval' = ANY(tags)
  AND status <> 'archived'
  AND slug <> ALL (ARRAY[${slugs.map(q).join(",")}]::text[]);
`;
}

// ---------------------------------------------------------------------------
// 直连 Supabase
// ---------------------------------------------------------------------------
async function uploadContent(url, key, path, body) {
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

async function directSync(items) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // 常规用法是 service role key（绕过 RLS）；SUPABASE_KEY 供一次性维护场景
  // 传入其它具备写权限的密钥。
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "直连模式需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY；\n" +
        "或改用 --emit <dir> 导出 SQL 与正文文件后离线加载。"
    );
  }
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const login = process.env.OWNER_GITHUB_LOGIN || DEFAULT_OWNER_LOGIN;
  const { data: prof } = await db
    .from("profiles")
    .select("id")
    .eq("github_login", login)
    .maybeSingle();
  const ownerId = prof?.id || DEFAULT_OWNER_ID;
  log(`owner = ${login} (${ownerId})`);

  let done = 0;
  for (const p of items) {
    const contentPath = `projects/${p.slug}`;
    await uploadContent(url, key, `${contentPath}/en.md`, p.content);

    const { data: proj, error: pe } = await db
      .from("projects")
      .upsert(
        {
          slug: p.slug,
          owner_id: ownerId,
          type: "challenge",
          title: { en: p.title },
          summary: { en: p.summary },
          repo_url: SYNC_REPO_URL,
          default_branch: SYNC_BRANCH,
          sync_branch: SYNC_BRANCH,
          sync_path: p.syncPath,
          difficulty: p.difficulty,
          tags: p.tags,
          status: "published",
          content_path: contentPath,
          content_locales: ["en"],
          managed_by_sync: true,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (pe) throw new Error(`project ${p.slug}: ${pe.message}`);

    const { error: pre } = await db.from("challenge_problems").upsert(
      {
        project_id: proj.id,
        slug: p.name,
        order_index: 1,
        title: { en: p.title },
        statement: { en: p.statement },
        challenge_lean_path: `${GEN}${p.name}/Challenge.lean`,
        challenge_lean_source: p.challengeSource,
        solution_module: p.solutionModule,
        theorem_names: p.theoremNames,
        permitted_axioms: p.permittedAxioms,
        definition_names: p.definitionNames,
        enable_nanoda: p.enableNanoda,
        bonus_points: p.bonusPoints,
        status: "open",
        verifier_problem_id: p.verifierProblemId,
        submission_templates: p.submissionTemplates,
        submission_enabled: p.submissionEnabled,
      },
      { onConflict: "project_id,slug" }
    );
    if (pre) throw new Error(`problem ${p.slug}: ${pre.message}`);
    if (++done % 25 === 0) log(`  已同步 ${done}/${items.length}`);
  }

  if (PRUNE) {
    const slugs = items.map((p) => p.slug);
    const { data: stale, error } = await db
      .from("projects")
      .update({ status: "archived" })
      .contains("tags", ["lean-eval"])
      .neq("status", "archived")
      .not("slug", "in", `(${slugs.map((s) => `"${s}"`).join(",")})`)
      .select("slug");
    if (error) log(`prune 失败（不影响同步）：${error.message}`);
    else if (stale?.length) log(`已下架 ${stale.length} 个仓库中已删除的题目`);
  }
  log(`完成 —— 同步 ${done} 个挑战项目。`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function loadTarball() {
  if (TARBALL) {
    log(`读取本地 tarball ${TARBALL}…`);
    return readFileSync(TARBALL);
  }
  log(`下载 ${TARBALL_URL} …`);
  const res = await fetch(TARBALL_URL, { headers: { "User-Agent": "math-challenge-sync" } });
  if (!res.ok) throw new Error(`tarball 下载失败: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const gz = await loadTarball();
  log(`tarball ${(gz.length / 1024 / 1024).toFixed(1)} MB —— 解压中…`);
  const files = readTar(gunzipSync(gz));
  const categoryById = parseManifestCategories(files);
  const { items: all, skipped } = collect(files, categoryById);
  const items = LIMIT ? all.slice(0, LIMIT) : all;

  log(`从 ${GEN} 解析出 ${all.length} 个挑战子文件夹` + (LIMIT ? `（本次只处理 ${items.length} 个）` : ""));
  if (skipped.length) log(`跳过 ${skipped.length} 个缺 README.md 的目录: ${skipped.slice(0, 5).join(", ")}…`);

  if (DRY_RUN) {
    const tests = items.filter((p) => p.isTest).length;
    const withLean = items.filter((p) => p.challengeSource).length;
    const withHole = items.filter((p) => p.statement.includes("```lean")).length;
    const withTemplates = items.filter(
      (p) => Boolean(p.submissionTemplates?.["Submission.lean"]),
    ).length;
    const dupes = items.length - new Set(items.map((p) => p.slug)).size;
    log("");
    log(`  test problem : ${tests}`);
    log(`  有 Challenge.lean : ${withLean}`);
    log(`  有形式化语句 : ${withHole}`);
    log(`  有提交模板 : ${withTemplates}`);
    log(`  slug 冲突 : ${dupes}`);
    log(`  正文平均长度 : ${Math.round(items.reduce((s, p) => s + p.content.length, 0) / items.length)} 字符`);
    log(`  Challenge.lean 最大 : ${Math.max(...items.map((p) => p.challengeSource.length))} 字符`);
    log("");
    log("样例:");
    console.log(JSON.stringify({ ...items[0], content: items[0].content.slice(0, 400) + "…" }, null, 2));
    return;
  }

  if (EMIT_DIR) {
    const ownerId = process.env.OWNER_USER_ID || DEFAULT_OWNER_ID;
    if (existsSync(EMIT_DIR)) rmSync(EMIT_DIR, { recursive: true, force: true });
    mkdirSync(join(EMIT_DIR, "sql"), { recursive: true });

    if (!VERIFIER_ONLY) {
      for (const p of items) {
        const file = join(EMIT_DIR, "content", `projects/${p.slug}`, "en.md");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, p.content, "utf8");
      }
    }

    let n = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
      const part = items.slice(i, i + CHUNK);
      writeFileSync(
        join(EMIT_DIR, "sql", `${String(++n).padStart(3, "0")}.sql`),
        `-- lean-eval 导入分片 ${n}（${part.length} 个项目）\n` +
          `-- 由 scripts/sync-lean-eval.mjs 生成，owner ${ownerId}\n\n` +
          "BEGIN;\n\n" +
          part
            .map((p) =>
              VERIFIER_ONLY ? verifierMetadataSql(p) : projectSql(p, ownerId),
            )
            .join("\n") +
          "\nCOMMIT;\n"
      );
    }
    if (PRUNE && !VERIFIER_ONLY) {
      writeFileSync(join(EMIT_DIR, "sql", "999_prune.sql"), pruneSql(items.map((p) => p.slug)));
    }
    log(`已导出 ${items.length} 个条目的 ${n} 个 SQL 分片到 ${EMIT_DIR}/`);
    return;
  }

  await directSync(items);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
