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
