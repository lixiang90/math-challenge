import type {
  AppLocale,
  I18nText,
  LeaderboardRow,
  ProblemDetail,
  ProblemListItem,
  Project,
  ProjectContent,
  ProjectDetail,
  ProjectDraft,
  ProjectListItem,
  ProjectMaintainer,
  Submission,
  SubmissionWithContext,
} from "@/lib/types";
import { parseGithubOwner, slugify } from "@/lib/utils";
import { fetchGithubFileTree } from "@/lib/github";
import { profiles, profileById } from "./profiles";
import { leanTree, projects } from "./projects";
import { problems } from "./problems";
import { pointsLedger, submissions } from "./submissions";

/** Which ref the file tree should be pulled from: pinned commit → branch → default branch. */
function treeRef(p: { sync_commit?: string | null; sync_branch?: string | null; default_branch?: string }): string {
  return p.sync_commit || p.sync_branch || p.default_branch || "main";
}

/** Build the rendered body from the mock `body` field, mirroring getProjectContent's locale→en fallback. */
function mockBodyContent(
  body: { en: string; zh?: string } | undefined,
  locale: AppLocale
): ProjectContent {
  const value = (body?.[locale] || body?.en || "").trim();
  const isFallback = !body || !body[locale];
  return { value, isFallback };
}

/** In-memory project_members for mock mode (mirrors supabase.project_members). */
const projectMembers: {
  project_id: string;
  user_id: string;
  role: string;
}[] = [];

/**
 * Phase-1 mock data layer, kept as the local fallback when the real
 * Supabase project is not configured (e.g. in this sandbox or during
 * local development before credentials are filled).
 */

function decorateProblem(problemId: string): ProblemListItem {
  const problem = problems.find((p) => p.id === problemId)!;
  const solverIds = new Set(
    submissions
      .filter((s) => s.problem_id === problemId && s.status === "passed")
      .map((s) => s.user_id)
  );
  return {
    ...problem,
    solver_count: solverIds.size,
    requires_manual_review: problem.definition_names.length > 0,
  };
}

function decorateProject(projectId: string): ProjectListItem {
  const project = projects.find((p) => p.id === projectId)!;
  const own = problems.filter((pr) => pr.project_id === projectId);
  const solverIds = new Set(
    submissions
      .filter(
        (s) =>
          s.status === "passed" && own.some((pr) => pr.id === s.problem_id)
      )
      .map((s) => s.user_id)
  );
  return {
    ...project,
    owner: profileById(project.owner_id),
    problem_count: own.length,
    total_bonus_points: own.reduce((sum, pr) => sum + pr.bonus_points, 0),
    solver_count: solverIds.size,
  };
}

export async function listProjects(): Promise<ProjectListItem[]> {
  return projects
    .filter((p) => p.status === "published")
    .map((p) => decorateProject(p.id));
}

export async function listAllTags(): Promise<string[]> {
  const set = new Set<string>();
  for (const p of projects) {
    if (p.status !== "published") continue;
    for (const tag of p.tags) set.add(tag);
  }
  return [...set].sort();
}

export async function getProjectBySlug(
  slug: string,
  locale: AppLocale = "en",
  opts: { withTree?: boolean } = {}
): Promise<ProjectDetail | null> {
  const project = projects.find((p) => p.slug === slug && p.status === "published");
  if (!project) return null;
  const own = problems
    .filter((pr) => pr.project_id === project.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map((pr) => decorateProblem(pr.id));
  // 正文走 mock 内联 body；文件树走 GitHub 实时拉取，拿不到时回退到样例树
  const content = mockBodyContent(project.body, locale);
  const fileTree = opts.withTree
    ? (await fetchGithubFileTree({
        repoUrl: project.repo_url,
        ref: treeRef(project),
        scopePath: project.sync_path,
      })) ?? leanTree
    : null;
  return { ...decorateProject(project.id), problems: own, content, file_tree: fileTree };
}

export async function getProblem(
  projectSlug: string,
  problemSlug: string
): Promise<ProblemDetail | null> {
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) return null;
  const problem = problems.find(
    (pr) => pr.project_id === project.id && pr.slug === problemSlug
  );
  if (!problem) return null;

  const solverIds = [
    ...new Set(
      submissions
        .filter((s) => s.problem_id === problem.id && s.status === "passed")
        .map((s) => s.user_id)
    ),
  ];

  return {
    ...decorateProblem(problem.id),
    project: {
      id: project.id,
      slug: project.slug,
      title: project.title,
      repo_url: project.repo_url,
      default_branch: project.default_branch,
    },
    solvers: solverIds.map(profileById),
  };
}

export async function listSubmissionsForProblem(
  problemId: string,
  userId: string
): Promise<Submission[]> {
  return submissions
    .filter((s) => s.problem_id === problemId && s.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function withContext(s: Submission): SubmissionWithContext {
  const problem = problems.find((p) => p.id === s.problem_id)!;
  const project = projects.find((p) => p.id === problem.project_id)!;
  return {
    ...s,
    problem: {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      project_id: problem.project_id,
    },
    project: { id: project.id, slug: project.slug, title: project.title },
  };
}

export async function listSubmissionsForUser(
  userId: string
): Promise<SubmissionWithContext[]> {
  return submissions
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(withContext);
}

export async function listProjectsByOwner(
  userId: string
): Promise<ProjectListItem[]> {
  return projects
    .filter((p) => p.owner_id === userId)
    .map((p) => decorateProject(p.id));
}

export async function getPointsLedger(userId: string) {
  return pointsLedger
    .filter((e) => e.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getProfileStats(userId: string) {
  const mine = submissions.filter((s) => s.user_id === userId);
  const solved = new Set(
    mine.filter((s) => s.status === "passed").map((s) => s.problem_id)
  );
  return {
    profile: profileById(userId),
    submission_count: mine.length,
    solved_count: solved.size,
    project_count: projects.filter((p) => p.owner_id === userId).length,
    points: pointsLedger
      .filter((e) => e.user_id === userId)
      .reduce((sum, e) => sum + e.delta, 0),
  };
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = profiles
    .map((profile) => {
      const points = pointsLedger
        .filter((e) => e.user_id === profile.id)
        .reduce((sum, e) => sum + e.delta, 0);
      const solved = new Set(
        submissions
          .filter((s) => s.user_id === profile.id && s.status === "passed")
          .map((s) => s.problem_id)
      ).size;
      return { profile, points, solved_count: solved };
    })
    .sort((a, b) => b.points - a.points || b.solved_count - a.solved_count);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getSiteStats() {
  const published = projects.filter((p) => p.status === "published");
  const openProblems = problems.filter((p) => p.status === "open");
  const solvers = new Set(
    submissions.filter((s) => s.status === "passed").map((s) => s.user_id)
  );
  return {
    projects: published.length,
    problems: openProblems.length,
    solvers: solvers.size,
    points: pointsLedger.reduce((sum, e) => sum + e.delta, 0),
  };
}

export async function createProject(
  draft: ProjectDraft,
  ownerId: string
): Promise<Project> {
  const slug = uniqueSlug(slugify(draft.title.en));
  const now = new Date().toISOString();
  const project: Project & { body?: I18nText } = {
    id: `mock_${slug}`,
    slug,
    owner_id: ownerId,
    type: draft.type,
    title: draft.title,
    summary: draft.summary,
    content_path: null,
    content_locales: [],
    body: draft.content,
    repo_url: draft.repo_url,
    default_branch: draft.default_branch || "main",
    sync_commit: draft.sync_commit ?? null,
    sync_branch: draft.sync_branch ?? null,
    sync_path: draft.sync_path ?? null,
    difficulty: draft.difficulty,
    tags: draft.tags,
    status: "published",
    managed_by_sync: false,
    created_at: now,
    updated_at: now,
  };
  projects.push(project);
  return project;
}

export async function updateProject(
  slug: string,
  draft: ProjectDraft
): Promise<Project> {
  const idx = projects.findIndex((p) => p.slug === slug);
  if (idx === -1) {
    return createProject(draft, "u_ai");
  }
  const existing = projects[idx];
  const updated: Project & { body?: I18nText } = {
    ...existing,
    type: draft.type,
    title: draft.title,
    summary: draft.summary,
    body: draft.content,
    repo_url: draft.repo_url,
    default_branch: draft.default_branch || "main",
    sync_commit: draft.sync_commit ?? null,
    sync_branch: draft.sync_branch ?? null,
    sync_path: draft.sync_path ?? null,
    difficulty: draft.difficulty,
    tags: draft.tags,
    managed_by_sync: existing.managed_by_sync ?? false,
    updated_at: new Date().toISOString(),
  };
  projects[idx] = updated;
  return updated;
}

export async function getProjectAccess(
  slug: string,
  userId: string
): Promise<{
  isOwner: boolean;
  isMaintainer: boolean;
  canClaim: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
}> {
  const project = projects.find((p) => p.slug === slug);
  if (!project) {
    return {
      isOwner: false,
      isMaintainer: false,
      canClaim: false,
      isAdmin: false,
      canEdit: false,
      canDelete: false,
    };
  }
  const isOwner = project.owner_id === userId;
  const isMaintainer = projectMembers.some(
    (m) => m.project_id === project.id && m.user_id === userId
  );
  // 本地演示无真实登录，管理员恒为 false；接真实 Supabase 后由 site_admins 决定。
  const isAdmin = false;
  let canClaim = false;
  if (!isOwner && !isMaintainer && !isAdmin) {
    const login = profileById(userId)?.github_login?.toLowerCase() ?? null;
    const repoOwner = parseGithubOwner(project.repo_url);
    canClaim = !!login && !!repoOwner && login === repoOwner;
  }
  const canEdit = isOwner || isMaintainer || isAdmin;
  const canDelete = (isOwner || isAdmin) && !project.managed_by_sync;
  return { isOwner, isMaintainer, canClaim, isAdmin, canEdit, canDelete };
}

export async function listMaintainers(
  projectId: string
): Promise<ProjectMaintainer[]> {
  return projectMembers
    .filter((m) => m.project_id === projectId)
    .map((m) => {
      const p = profileById(m.user_id);
      return {
        user_id: m.user_id,
        github_login: p?.github_login ?? "unknown",
        display_name: p?.display_name ?? "Unknown",
      };
    });
}

export async function claimProject(
  slug: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const project = projects.find((p) => p.slug === slug && p.status === "published");
  if (!project) return { ok: false, error: "not_found" };
  if (project.owner_id === userId) return { ok: true };
  const login = profileById(userId)?.github_login?.toLowerCase() ?? null;
  const repoOwner = parseGithubOwner(project.repo_url);
  if (!login || !repoOwner || login !== repoOwner) {
    return { ok: false, error: "not_owner" };
  }
  if (!projectMembers.some((m) => m.project_id === project.id && m.user_id === userId)) {
    projectMembers.push({ project_id: project.id, user_id: userId, role: "maintainer" });
  }
  return { ok: true };
}

export async function deleteProject(
  slug: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const idx = projects.findIndex((p) => p.slug === slug);
  if (idx < 0) return { ok: false, error: "not_found" };
  const project = projects[idx];
  const isOwner = project.owner_id === userId;
  const isAdmin = false; // 本地演示无真实登录
  const canDelete = (isOwner || isAdmin) && !project.managed_by_sync;
  if (!canDelete) return { ok: false, error: "permissionDenied" };
  projects.splice(idx, 1);
  return { ok: true };
}

function uniqueSlug(base: string): string {
  let slug = base;
  let i = 1;
  while (projects.some((p) => p.slug === slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}
