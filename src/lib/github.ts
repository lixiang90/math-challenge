import type { FileNode } from "@/lib/types";

/**
 * 从 GitHub 实时拉取仓库文件树。
 *
 * 两条路径，都只发 1 个请求：
 *
 * 1. git-trees API（`?recursive=1`）一次拿回整棵树。对绝大多数仓库够用，
 *    而且同一个 repo@ref 只需请求一次——lean-eval 下 231 个挑战项目共用
 *    同一棵树，按 repo 缓存原始条目后，各项目只是在内存里切自己那段子路径。
 *
 * 2. 超大仓库（mathlib4 十万级文件）会被 GitHub 截断并返回 `truncated: true`，
 *    此时整棵树不可信。退回 contents API 只取当前目录一层，请求数依然是 1，
 *    只是不展开子目录。
 *
 * 未认证的 GitHub API 限流是 60 次/小时，配 `GITHUB_TOKEN` 可提到 5000。
 * 配合下面的进程内缓存，正常浏览量下不会打满。
 */

const GITHUB_API = "https://api.github.com";
const TREE_TTL_MS = 60 * 60 * 1000; // 整棵树缓存 1 小时
const MAX_REL_DEPTH = 2; // 相对作用域路径的展开深度
const MAX_CHILDREN = 80; // 单个目录最多渲染多少子项
const FETCH_TIMEOUT_MS = 8000;

export interface GithubRef {
  owner: string;
  repo: string;
}

/** 从 GitHub URL 解析 `{ owner, repo }`，兼容 /tree/... 形式与 .git 后缀。 */
export function parseGithubRepo(input: string): GithubRef | null {
  const m = input.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  const owner = m[1];
  let repo = m[2];
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);
  if (!owner || !repo) return null;
  return { owner, repo };
}

interface GitTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
}

interface RawTree {
  entries: GitTreeEntry[];
  truncated: boolean;
}

const treeCache = new Map<string, { expires: number; value: RawTree | null }>();

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "math-challenge",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch(url: string): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: ghHeaders(),
      signal: ac.signal,
      // 树结构变化不频繁，交给 Next 的数据缓存兜一层
      next: { revalidate: 3600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 拉整棵树（按 repo@ref 缓存，同仓库的所有项目共用）。 */
async function fetchRepoTree(
  owner: string,
  repo: string,
  ref: string
): Promise<RawTree | null> {
  const key = `${owner}/${repo}@${ref}`;
  const hit = treeCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value: RawTree | null = null;
  try {
    const res = await ghFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
    );
    if (res.ok) {
      const data = (await res.json()) as { tree?: GitTreeEntry[]; truncated?: boolean };
      value = { entries: data.tree ?? [], truncated: Boolean(data.truncated) };
    }
  } catch {
    value = null;
  }
  // 失败也缓存（TTL 短一些），避免每次刷新都去撞限流
  treeCache.set(key, {
    expires: Date.now() + (value ? TREE_TTL_MS : 60_000),
    value,
  });
  return value;
}

/** 树被截断时的退路：contents API 只取一层目录。 */
async function fetchDirListing(
  owner: string,
  repo: string,
  ref: string,
  path: string
): Promise<FileNode[] | null> {
  try {
    const res = await ghFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${path
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(ref)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const nodes: FileNode[] = data.map((e: { name: string; type: string; size?: number }) => ({
      name: e.name,
      type: e.type === "dir" ? "dir" : "file",
      ...(e.type === "dir" ? { children: [] } : { size: e.size }),
    }));
    return sortAndCap(nodes);
  } catch {
    return null;
  }
}

function sortAndCap(nodes: FileNode[]): FileNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const capped = nodes.slice(0, MAX_CHILDREN);
  for (const n of capped) if (n.children) n.children = sortAndCap(n.children);
  return capped;
}

/** 把扁平条目折叠成嵌套结构，只保留 `scopePath` 下的部分。 */
function buildTree(entries: GitTreeEntry[], scopePath: string): FileNode[] {
  const clean = scopePath.replace(/^\/+|\/+$/g, "");
  const prefix = clean ? `${clean}/` : "";
  const roots: FileNode[] = [];
  const dirIndex = new Map<string, FileNode>();

  const ensureDir = (fullKey: string, name: string, parent: FileNode[]): FileNode => {
    let node = dirIndex.get(fullKey);
    if (!node) {
      node = { name, type: "dir", children: [] };
      dirIndex.set(fullKey, node);
      parent.push(node);
    }
    return node;
  };

  for (const e of entries) {
    if (e.type === "commit") continue; // 子模块，跳过
    if (prefix && !e.path.startsWith(prefix)) continue;
    const rel = prefix ? e.path.slice(prefix.length) : e.path;
    const segs = rel.split("/").filter(Boolean);
    if (segs.length === 0 || segs.length > MAX_REL_DEPTH) continue;

    let level = roots;
    let acc = "";
    for (let i = 0; i < segs.length - 1; i++) {
      acc = acc ? `${acc}/${segs[i]}` : segs[i];
      level = ensureDir(acc, segs[i], level).children!;
    }
    const name = segs[segs.length - 1];
    const fullKey = acc ? `${acc}/${name}` : name;
    if (e.type === "tree") ensureDir(fullKey, name, level);
    else if (!dirIndex.has(fullKey)) level.push({ name, type: "file", size: e.size });
  }
  return sortAndCap(roots);
}

export interface FileTreeRequest {
  repoUrl: string;
  /** 分支或 commit SHA；调用方负责按 sync_commit → sync_branch → default_branch 决定。 */
  ref: string;
  /** 仓库内子路径，空表示仓库根。 */
  scopePath?: string | null;
}

/**
 * 拉取并裁剪文件树。任何失败都返回 `null`，由调用方降级——
 * 文件树只是详情页的辅助信息，不该因为 GitHub 抽风而让整页崩掉。
 */
export async function fetchGithubFileTree({
  repoUrl,
  ref,
  scopePath,
}: FileTreeRequest): Promise<FileNode[] | null> {
  const repo = parseGithubRepo(repoUrl || "");
  if (!repo || !ref) return null;
  const scope = (scopePath ?? "").replace(/^\/+|\/+$/g, "");

  const raw = await fetchRepoTree(repo.owner, repo.repo, ref);
  if (raw && !raw.truncated) {
    const tree = buildTree(raw.entries, scope);
    if (tree.length) return tree;
  }
  // 树被截断（超大仓库）或作用域内没命中，退回单层目录列举
  return fetchDirListing(repo.owner, repo.repo, ref, scope);
}
