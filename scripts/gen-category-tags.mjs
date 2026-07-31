#!/usr/bin/env node
/**
 * gen-category-tags.mjs — 依据 lean-eval 的 manifests/problems/<id>.toml 的
 * `module = "LeanEval.<分类>.<Name>"` 字段，把每个挑战的数学分类提取成
 * kebab-case 标签（如 Algebra -> algebra，NumberTheory -> number-theory），
 * 然后：
 *   1) 打印每个分类的题目数分布 + 任何无法归类（module 不符合模式）的异常
 *   2) 写出 supabase/migrations/0008_lean_eval_categories.sql
 *      一条 CTE UPDATE，把分类标签补进已导入项目的 tags（幂等、去重）
 *   3) 写出 .cache/lean-eval-id2cat.json 供 sync-lean-eval.mjs 复用
 *
 * 不写任何库，只解析 + 生成补丁文件。
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO = "leanprover/lean-eval";
const BRANCH = "main";
const TARBALL_URL = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}`;
const CACHE = join(process.cwd(), ".cache", "lean-eval-main.tar.gz");

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
    if (hdr.every((b) => b === 0)) break;
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

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
if (PROXY) {
  try {
    const { setGlobalDispatcher, ProxyAgent } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(PROXY));
    console.error(`[proxy] ${PROXY}`);
  } catch {}
}

async function loadTarball() {
  if (existsSync(CACHE)) {
    console.error(`[cache] 读取 ${CACHE}`);
    return readFileSync(CACHE);
  }
  console.error(`下载 ${TARBALL_URL} …`);
  const res = await fetch(TARBALL_URL, { headers: { "User-Agent": "math-challenge-gencat" } });
  if (!res.ok) throw new Error(`tarball 下载失败: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
  writeFileSync(CACHE, buf);
  return buf;
}

function slugifyCat(cat) {
  // Algebra -> algebra, NumberTheory -> number-theory, AlgebraicGeometry -> algebraic-geometry
  return cat
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const gz = await loadTarball();
const files = readTar(gunzipSync(gz));

// 解析 manifests/problems/<id>.toml
const idCat = new Map();
const anomalies = [];
for (const [path, buf] of files) {
  const m = path.match(/lean-eval-main\/manifests\/problems\/(.+)\.toml$/);
  if (!m) continue;
  const id = m[1];
  const txt = buf.toString("utf8");
  const modLine = txt.match(/^module\s*=\s*"([^"]+)"/m);
  if (!modLine) {
    anomalies.push({ id, reason: "无 module 字段" });
    continue;
  }
  const segs = modLine[1].split(".");
  if (segs[0] !== "LeanEval") {
    anomalies.push({ id, reason: `module 不以 LeanEval. 开头: ${modLine[1]}` });
    continue;
  }
  // 根目录的 EasyProblems.lean（two_plus_two 等自检题）只有两段：
  // 归到专属的 easy-problems 标签，而不是遗漏。
  if (segs.length === 2 && segs[1] === "EasyProblems") {
    idCat.set(id, "easy-problems");
    continue;
  }
  if (segs.length < 3) {
    anomalies.push({ id, reason: `module 不符合 LeanEval.<Cat>.<Name>: ${modLine[1]}` });
    continue;
  }
  idCat.set(id, slugifyCat(segs[1]));
}

// 交叉校验：generated/ 子文件夹名应全部能在 idCat 找到
const genNames = new Set();
for (const [path] of files) {
  const m = path.match(/lean-eval-main\/generated\/([^/]+)\/README\.md$/);
  if (m) genNames.add(m[1]);
}
const missing = [...genNames].filter((n) => !idCat.has(n));

// 分布
const dist = new Map();
for (const cat of idCat.values()) dist.set(cat, (dist.get(cat) || 0) + 1);

console.log("=== 分类分布（kebab-case 标签 → 题目数）===");
for (const [cat, n] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${n}`);
}
console.log(`  合计可归类: ${idCat.size}`);
console.log(`  generated 子文件夹数: ${genNames.size}`);
console.log(`  无法归类(异常): ${anomalies.length}`);
for (const a of anomalies.slice(0, 20)) console.log(`    - ${a.id}: ${a.reason}`);
console.log(`  generated 中缺 manifest 映射: ${missing.length}`);
for (const n of missing.slice(0, 20)) console.log(`    - ${n}`);

// 写 JSON 映射（供 sync 脚本）
mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
writeFileSync(join(process.cwd(), ".cache", "lean-eval-id2cat.json"), JSON.stringify(Object.fromEntries(idCat), null, 2));

// 生成 SQL 补丁：CTE + 单次 UPDATE，幂等、去重
const rows = [...idCat.entries()]
  .map(([id, cat]) => `  (${q(id)}, ${q(cat)})`)
  .join(",\n");
const sql = `-- 0008_lean_eval_categories.sql
-- 给已导入的 lean-eval 挑战项目追加「数学分类」标签。
-- 分类源自 lean-eval manifests/problems/<id>.toml 的 module 字段
-- （LeanEval.<分类>.<Name> 的第二段），slug 化后作为 tags 元素。
-- 幂等：仅对带 'lean-eval' 标签且尚未含该分类标签的项目追加；DISTINCT 去重。
WITH cat(slug, cat) AS (
  VALUES
${rows}
)
UPDATE public.projects p
SET tags = ARRAY(
  SELECT DISTINCT e FROM unnest(p.tags || ARRAY[cat.cat]) AS e
)
FROM cat
WHERE p.slug = cat.slug
  AND 'lean-eval' = ANY(p.tags)
  AND NOT (cat.cat = ANY(p.tags));
`;
const outPath = join(process.cwd(), "supabase", "migrations", "0008_lean_eval_categories.sql");
mkdirSync(join(process.cwd(), "supabase", "migrations"), { recursive: true });
writeFileSync(outPath, sql);
console.error(`[done] 已写出 ${outPath}`);

function q(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}
