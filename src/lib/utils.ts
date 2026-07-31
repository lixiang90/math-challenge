import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export function shortSha(sha: string) {
  return sha.slice(0, 7);
}

/** Convert a human title into a URL-safe slug. Keeps unicode letters/numbers. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "project";
}

const GITHUB_REPO_RE =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/i;
const SHA40_RE = /^[0-9a-f]{40}$/i;
const GITHUB_TREE_RE =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/tree\/([^/?#]+)(?:\/([^?#]*))?/i;

/** Parse a GitHub URL that already points at `/tree/{ref}/{path}`.
 *  Returns the repo root, the ref (commit sha or branch), and the sub-path. */
export function parseGithubTreeUrl(url: string): {
  base: string;
  ref: string | null;
  path: string | null;
} | null {
  const m = url.match(GITHUB_TREE_RE);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2];
  const ref = m[3] || null;
  let path = m[4] ? m[4].replace(/\/+$/, "") : null;
  if (path === "") path = null;
  return { base: `https://github.com/${owner}/${repo}`, ref, path };
}

const GITHUB_OWNER_RE = /^https:\/\/github\.com\/([^/]+)\//i;

/** Extract the GitHub repository owner (the `{owner}` segment) from a repo URL.
 *  Case-insensitive; used by the claim flow to verify the logged-in user owns
 *  the repository. Returns null for non-GitHub or malformed URLs. */
export function parseGithubOwner(repoUrl: string): string | null {
  const m = repoUrl.match(GITHUB_OWNER_RE);
  return m ? m[1].toLowerCase() : null;
}

/** Build the most useful GitHub link for a project.
 *  - Normal projects link to the repo homepage.
 *  - Challenge projects link to the pinned commit/branch + optional sync_path.
 */
export function githubRepoUrl(params: {
  repoUrl: string;
  type: "normal" | "challenge";
  defaultBranch?: string | null;
  syncBranch?: string | null;
  syncCommit?: string | null;
  syncPath?: string | null;
}): string {
  const match = params.repoUrl.match(GITHUB_REPO_RE);
  if (!match) return params.repoUrl;

  const [, owner, repo] = match;
  const base = `https://github.com/${owner}/${repo}`;

  if (params.type !== "challenge") return base;

  const commit = params.syncCommit?.trim();
  const branch = params.syncBranch?.trim() || params.defaultBranch?.trim();
  const path = params.syncPath?.trim();

  if (commit && SHA40_RE.test(commit)) {
    return path ? `${base}/tree/${commit}/${path}` : `${base}/tree/${commit}`;
  }

  if (branch) {
    return path ? `${base}/tree/${branch}/${path}` : `${base}/tree/${branch}`;
  }

  return base;
}
