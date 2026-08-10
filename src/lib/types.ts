/**
 * Row shapes mirroring the planned Supabase schema (see PLAN.md §3).
 * Phase 1 fills these from mock data; phase 2 swaps in real queries
 * without changing any consumer.
 */

export type AppLocale = "en" | "zh";

/** Multi-language text column, stored as jsonb. `en` is the fallback and is required. */
export type I18nText = { en: string } & Partial<Record<AppLocale, string>>;

export type ProjectType = "normal" | "challenge";

export type Difficulty = "intro" | "easy" | "medium" | "hard" | "research";

export type ProjectStatus = "draft" | "published" | "archived";

export type SubmissionStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "error"
  | "timeout"
  | "review";

export interface Profile {
  id: string;
  github_login: string;
  display_name: string;
  avatar_url: string | null;
  bio: I18nText | null;
  total_points: number;
  created_at: string;
}

export interface Project {
  id: string;
  slug: string;
  owner_id: string;
  type: ProjectType;
  title: I18nText;
  summary: I18nText;
  /**
   * Storage 对象前缀（桶 `project-content`），如 `projects/<slug>`。
   * 正文本体是 `<content_path>/<locale>.md`，表里不再存长文本。
   */
  content_path: string | null;
  /** 正文实际存在哪些语种，免去逐个 HEAD 探测文件是否存在。 */
  content_locales: AppLocale[];
  repo_url: string;
  default_branch: string;
  /** Challenge only: pin the synced commit; null = latest at sync time. */
  sync_commit?: string | null;
  /** Challenge only: branch to sync from; null = use `default_branch`. */
  sync_branch?: string | null;
  /** Challenge only: relative path inside the repo; null = repo root. */
  sync_path?: string | null;
  difficulty: Difficulty;
  tags: string[];
  status: ProjectStatus;
  /**
   * True for official / sync-imported content (e.g. the 231 lean-eval imports).
   * Such projects are delete-protected — only the sync script / service_role
   * may remove them. Set on upsert by the sync tooling.
   */
  managed_by_sync: boolean;
  created_at: string;
  updated_at: string;
}

/** 一篇从 Storage 取回的项目正文。 */
export interface ProjectContent {
  /** Markdown 原文；正文缺失时为空串。 */
  value: string;
  /** 请求的语种没有译文，回退到了 `en`。 */
  isFallback: boolean;
}

/** A user granted edit/maintain rights on a project via claim (besides owner). */
export interface ProjectMaintainer {
  user_id: string;
  github_login: string;
  display_name: string;
}

export interface FileNode {
  name: string;
  type: "dir" | "file";
  size?: number;
  children?: FileNode[];
}

export interface ChallengeProblem {
  id: string;
  project_id: string;
  slug: string;
  order_index: number;
  title: I18nText;
  statement: I18nText;
  challenge_lean_path: string;
  /** Rendered read-only in the UI; sourced from the repo in later phases. */
  challenge_lean_source: string;
  solution_module: string;
  theorem_names: string[];
  permitted_axioms: string[];
  definition_names: string[];
  enable_nanoda: boolean;
  bonus_points: number;
  deadline: string | null;
  status: "open" | "closed";
  /** lean-eval generated workspace id. Present once the verifier sync ran. */
  verifier_problem_id?: string | null;
  /** Pristine root submission and nested Lean-module starter files. */
  submission_templates?: Record<string, string> | null;
  submission_enabled?: boolean;
}

export interface SubmissionVerdict {
  ok: boolean;
  stage:
    | "clone"
    | "build_challenge"
    | "build_solution"
    | "declaration_match"
    | "axiom_check"
    | "kernel_replay"
    | "verification"
    | "done";
  message: string;
  axioms_used?: string[];
  summary?: Record<string, unknown> | null;
}

export interface Submission {
  id: string;
  problem_id: string;
  user_id: string;
  repo_url: string | null;
  commit_sha: string | null;
  solution_path: string | null;
  source_kind?: "inline" | "repo";
  solution_digest?: string | null;
  benchmark_commit?: string | null;
  status: SubmissionStatus;
  verdict: SubmissionVerdict | null;
  log_url: string | null;
  runner_run_id: string | null;
  points_awarded: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message?: string | null;
}

export interface PointsLedgerEntry {
  id: string;
  user_id: string;
  problem_id: string;
  submission_id: string;
  delta: number;
  /** i18n message key + params, resolved at render time. */
  reason_key: "reasonFirstSolve";
  reason_params: Record<string, string>;
  created_at: string;
}

/** Sanitized payload accepted by the project create/update data-layer calls. */
export interface ProjectDraft {
  type: ProjectType;
  title: I18nText;
  summary: I18nText;
  /** 正文按语种写进 Storage，不入表。 */
  content: I18nText;
  repo_url: string;
  default_branch: string;
  /** Challenge only; ignored for normal projects. */
  sync_commit?: string | null;
  sync_branch?: string | null;
  sync_path?: string | null;
  difficulty: Difficulty;
  tags: string[];
}

/* ---------- Derived view models returned by the data layer ---------- */

export interface ProjectListItem extends Project {
  owner: Profile;
  problem_count: number;
  total_bonus_points: number;
  solver_count: number;
}

export interface ProblemListItem extends ChallengeProblem {
  solver_count: number;
  /** Requires manual review because the problem contains definition holes. */
  requires_manual_review: boolean;
}

export interface ProjectDetail extends ProjectListItem {
  problems: ProblemListItem[];
  /** 从 Storage 取回的正文，已按当前语种解析并处理回退。 */
  content: ProjectContent;
  /** 编辑时预填中文正文（仅 edit 页面请求时填充）。 */
  contentZh?: string;
  /** GitHub 实时拉取的文件树；拉取失败或非 GitHub 仓库时为 null。 */
  file_tree: FileNode[] | null;
}

export interface ProblemDetail extends ProblemListItem {
  project: Pick<Project, "id" | "slug" | "title" | "repo_url" | "default_branch">;
  solvers: Profile[];
}

export interface SubmissionWithContext extends Submission {
  problem: Pick<ChallengeProblem, "id" | "slug" | "title" | "project_id">;
  project: Pick<Project, "id" | "slug" | "title">;
}

export interface LeaderboardRow {
  rank: number;
  profile: Profile;
  solved_count: number;
  points: number;
}
