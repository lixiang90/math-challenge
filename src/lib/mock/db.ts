import type {
  AppLocale,
  ChallengeProblem,
  LeaderboardRow,
  ProblemDetail,
  ProblemListItem,
  Profile,
  Project,
  ProjectDetail,
  ProjectDraft,
  ProjectListItem,
  ProjectMaintainer,
  Submission,
  SubmissionWithContext,
} from "@/lib/types";
import { parseGithubOwner, slugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { ensureInitialAdmins } from "@/lib/admin";
import { fetchGithubFileTree } from "@/lib/github";
import {
  contentPathFor,
  getProjectContent,
  putProjectContent,
} from "@/lib/project-content";
import * as mock from "./fallback";

/**
 * Phase-2 data layer.
 *
 * Uses real Supabase queries when credentials are configured; otherwise falls
 * back to the local mock data in `./fallback.ts`. The exported shapes are
 * identical in both modes, so pages/components do not need to change.
 */

export function useMock(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.toLowerCase();
  return !url || url.includes("your-project-ref") || url.includes("example.com");
}

export async function listProjects(): Promise<ProjectListItem[]> {
  if (useMock()) return mock.listProjects();

  const supabase = await createClient();
  const [projectsRes, problemsRes, submissionsRes, profilesRes] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase
        .from("challenge_problems")
        .select("id,project_id,bonus_points"),
      supabase
        .from("submissions")
        .select("problem_id,user_id,status")
        .eq("status", "passed"),
      supabase.from("profiles").select("*"),
    ]);

  if (projectsRes.error) throw projectsRes.error;
  const projects = (projectsRes.data ?? []) as Project[];
  const problems =
    (problemsRes.data ?? []) as Pick<
      ChallengeProblem,
      "id" | "project_id" | "bonus_points"
    >[];
  const submissions = (submissionsRes.data ?? []) as Pick<
    Submission,
    "problem_id" | "user_id" | "status"
  >[];
  const profiles = (profilesRes.data ?? []) as Profile[];

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const problemsByProject = new Map<string, typeof problems>();
  for (const p of problems) {
    const arr = problemsByProject.get(p.project_id) ?? [];
    arr.push(p);
    problemsByProject.set(p.project_id, arr);
  }
  const solversByProblem = new Map<string, Set<string>>();
  for (const s of submissions) {
    const set = solversByProblem.get(s.problem_id) ?? new Set();
    set.add(s.user_id);
    solversByProblem.set(s.problem_id, set);
  }

  return projects.map((project) => {
    const own = problemsByProject.get(project.id) ?? [];
    const solverIds = new Set<string>();
    for (const p of own) {
      for (const uid of solversByProblem.get(p.id) ?? []) solverIds.add(uid);
    }
    return {
      ...project,
      owner: profileMap.get(project.owner_id)!,
      problem_count: own.length,
      total_bonus_points: own.reduce((sum, p) => sum + p.bonus_points, 0),
      solver_count: solverIds.size,
    };
  });
}

export async function listAllTags(): Promise<string[]> {
  if (useMock()) return mock.listAllTags();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("tags")
    .eq("status", "published");
  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    for (const tag of (row.tags as string[]) ?? []) set.add(tag);
  }
  return [...set].sort();
}

/** 文件树该拉哪个 ref：钉死的 commit 优先，其次同步分支，最后默认分支。 */
function treeRef(project: Project): string {
  return project.sync_commit || project.sync_branch || project.default_branch || "main";
}

export async function getProjectBySlug(
  slug: string,
  locale: AppLocale = "en",
  opts: { withTree?: boolean } = {}
): Promise<ProjectDetail | null> {
  if (useMock()) return mock.getProjectBySlug(slug, locale, opts);

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!project) return null;

  const [problemsRes, submissionsRes, profilesRes] = await Promise.all([
    supabase
      .from("challenge_problems")
      .select("*")
      .eq("project_id", project.id)
      .order("order_index", { ascending: true }),
    supabase
      .from("submissions")
      .select("problem_id,user_id,status")
      .eq("status", "passed"),
    supabase.from("profiles").select("*"),
  ]);

  const problems = (problemsRes.data ?? []) as ChallengeProblem[];
  const submissions = (submissionsRes.data ?? []) as Pick<
    Submission,
    "problem_id" | "user_id" | "status"
  >[];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const solversByProblem = new Map<string, Set<string>>();
  for (const s of submissions) {
    const set = solversByProblem.get(s.problem_id) ?? new Set();
    set.add(s.user_id);
    solversByProblem.set(s.problem_id, set);
  }

  const own = problems.map((p) => ({
    ...p,
    solver_count: solversByProblem.get(p.id)?.size ?? 0,
    requires_manual_review: p.definition_names.length > 0,
  }));
  const solverIds = new Set<string>();
  for (const p of own) {
    for (const uid of solversByProblem.get(p.id) ?? []) solverIds.add(uid);
  }

  const row = project as Project;
  // 正文走 Storage、文件树走 GitHub，两个都是外部 I/O，并发拿
  const [content, contentZhRaw, fileTree] = await Promise.all([
    getProjectContent(row.content_path, row.content_locales, locale),
    // 编辑页需要预填中文正文；zh == en 时跳过重复请求
    locale !== "zh"
      ? getProjectContent(row.content_path, row.content_locales, "zh")
      : Promise.resolve({ value: "", isFallback: false }),
    opts.withTree
      ? fetchGithubFileTree({
          repoUrl: row.repo_url,
          ref: treeRef(row),
          scopePath: row.sync_path,
        })
      : Promise.resolve(null),
  ]);

  return {
    ...row,
    owner: profileMap.get(project.owner_id)!,
    problem_count: own.length,
    total_bonus_points: own.reduce((sum, p) => sum + p.bonus_points, 0),
    solver_count: solverIds.size,
    problems: own,
    content,
    contentZh: contentZhRaw.value || undefined,
    file_tree: fileTree,
  };
}

export async function getProblem(
  projectSlug: string,
  problemSlug: string
): Promise<ProblemDetail | null> {
  if (useMock()) return mock.getProblem(projectSlug, problemSlug);

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id,slug,title,repo_url,default_branch")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) return null;

  const { data: problem } = await supabase
    .from("challenge_problems")
    .select("*")
    .eq("project_id", project.id)
    .eq("slug", problemSlug)
    .maybeSingle();
  if (!problem) return null;

  const { data: passedSubmissions } = await supabase
    .from("submissions")
    .select("user_id")
    .eq("problem_id", problem.id)
    .eq("status", "passed");
  const solverIds = [
    ...new Set((passedSubmissions ?? []).map((s) => s.user_id as string)),
  ];
  const { data: solvers } = await supabase
    .from("profiles")
    .select("*")
    .in("id", solverIds);

  return {
    ...(problem as ChallengeProblem),
    solver_count: solverIds.length,
    requires_manual_review: (problem.definition_names as string[]).length > 0,
    project,
    solvers: ((solvers ?? []) as Profile[]).filter((p) =>
      solverIds.includes(p.id)
    ),
  };
}

// Supabase `user_id` columns are uuid; a non-uuid value (e.g. the legacy
// DEMO_USER_ID "u_ai") would otherwise throw "invalid input syntax for type
// uuid" and crash the server component. Guard before querying.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listSubmissionsForProblem(
  problemId: string,
  userId: string
): Promise<Submission[]> {
  if (useMock()) return mock.listSubmissionsForProblem(problemId, userId);
  if (!UUID_RE.test(userId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("problem_id", problemId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

export async function listSubmissionsForUser(
  userId: string
): Promise<SubmissionWithContext[]> {
  if (useMock()) return mock.listSubmissionsForUser(userId);
  if (!UUID_RE.test(userId)) return [];

  const supabase = await createClient();
  const { data: subs, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!subs?.length) return [];

  const problemIds = [...new Set(subs.map((s) => s.problem_id as string))];
  const { data: problems } = await supabase
    .from("challenge_problems")
    .select("id,slug,title,project_id")
    .in("id", problemIds);
  const projectIds = [
    ...new Set((problems ?? []).map((p) => p.project_id as string)),
  ];
  const { data: projects } = await supabase
    .from("projects")
    .select("id,slug,title")
    .in("id", projectIds);

  const problemMap = new Map(
    (problems ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        slug: p.slug as string,
        title: p.title as { en: string; zh?: string },
        project_id: p.project_id as string,
      },
    ])
  );
  const projectMap = new Map(
    (projects ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        slug: p.slug as string,
        title: p.title as { en: string; zh?: string },
      },
    ])
  );

  return (subs as Submission[]).map((s) => ({
    ...s,
    problem: problemMap.get(s.problem_id)!,
    project: projectMap.get(problemMap.get(s.problem_id)!.project_id)!,
  }));
}

export async function listProjectsByOwner(
  userId: string
): Promise<ProjectListItem[]> {
  if (useMock()) return mock.listProjectsByOwner(userId);

  const supabase = await createClient();
  const [projectsRes, problemsRes, submissionsRes, profilesRes] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("challenge_problems")
        .select("id,project_id,bonus_points"),
      supabase
        .from("submissions")
        .select("problem_id,user_id,status")
        .eq("status", "passed"),
      supabase.from("profiles").select("*"),
    ]);

  if (projectsRes.error) throw projectsRes.error;
  const projects = (projectsRes.data ?? []) as Project[];
  const problems =
    (problemsRes.data ?? []) as Pick<
      ChallengeProblem,
      "id" | "project_id" | "bonus_points"
    >[];
  const submissions = (submissionsRes.data ?? []) as Pick<
    Submission,
    "problem_id" | "user_id" | "status"
  >[];
  const profiles = (profilesRes.data ?? []) as Profile[];

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const problemsByProject = new Map<string, typeof problems>();
  for (const p of problems) {
    const arr = problemsByProject.get(p.project_id) ?? [];
    arr.push(p);
    problemsByProject.set(p.project_id, arr);
  }
  const solversByProblem = new Map<string, Set<string>>();
  for (const s of submissions) {
    const set = solversByProblem.get(s.problem_id) ?? new Set();
    set.add(s.user_id);
    solversByProblem.set(s.problem_id, set);
  }

  return projects.map((project) => {
    const own = problemsByProject.get(project.id) ?? [];
    const solverIds = new Set<string>();
    for (const p of own) {
      for (const uid of solversByProblem.get(p.id) ?? []) solverIds.add(uid);
    }
    return {
      ...project,
      owner: profileMap.get(project.owner_id)!,
      problem_count: own.length,
      total_bonus_points: own.reduce((sum, p) => sum + p.bonus_points, 0),
      solver_count: solverIds.size,
    };
  });
}

export async function getPointsLedger(userId: string) {
  if (useMock()) return mock.getPointsLedger(userId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("points_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProfileStats(userId: string) {
  if (useMock()) return mock.getProfileStats(userId);

  const supabase = await createClient();
  const [profileRes, subsRes, projectsRes, ledgerRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("submissions")
      .select("status,problem_id")
      .eq("user_id", userId),
    supabase.from("projects").select("id").eq("owner_id", userId),
    supabase.from("points_ledger").select("delta").eq("user_id", userId),
  ]);

  if (profileRes.error) throw profileRes.error;
  const profile = (profileRes.data as Profile | null) ?? null;
  const subs = (subsRes.data ?? []) as Pick<Submission, "status" | "problem_id">[];
  const solved = new Set(
    subs.filter((s) => s.status === "passed").map((s) => s.problem_id)
  );
  const points = (ledgerRes.data ?? []).reduce(
    (sum: number, e: { delta: number }) => sum + e.delta,
    0
  );

  return {
    profile,
    submission_count: subs.length,
    solved_count: solved.size,
    project_count: (projectsRes.data ?? []).length,
    points,
  };
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  if (useMock()) return mock.getLeaderboard();

  const supabase = await createClient();
  const [profilesRes, ledgerRes, subsRes] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("points_ledger").select("user_id,delta"),
    supabase
      .from("submissions")
      .select("user_id,problem_id,status")
      .eq("status", "passed"),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];
  const ledger = ledgerRes.data ?? [];
  const subs = subsRes.data ?? [];

  const pointsByUser = new Map<string, number>();
  for (const e of ledger) {
    const uid = e.user_id as string;
    pointsByUser.set(uid, (pointsByUser.get(uid) ?? 0) + (e.delta as number));
  }
  const solvedByUser = new Map<string, Set<string>>();
  for (const s of subs) {
    if (s.status !== "passed") continue;
    const uid = s.user_id as string;
    const set = solvedByUser.get(uid) ?? new Set();
    set.add(s.problem_id as string);
    solvedByUser.set(uid, set);
  }

  const rows = profiles
    .map((profile) => ({
      profile,
      points: pointsByUser.get(profile.id) ?? 0,
      solved_count: solvedByUser.get(profile.id)?.size ?? 0,
    }))
    .sort((a, b) => b.points - a.points || b.solved_count - a.solved_count);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getSiteStats() {
  if (useMock()) return mock.getSiteStats();

  const supabase = await createClient();
  const [projectsRes, problemsRes, subsRes, ledgerRes] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact" }).eq("status", "published"),
    supabase.from("challenge_problems").select("id", { count: "exact" }).eq("status", "open"),
    supabase
      .from("submissions")
      .select("user_id")
      .eq("status", "passed"),
    supabase.from("points_ledger").select("delta"),
  ]);

  const solvers = new Set((subsRes.data ?? []).map((s) => s.user_id as string));
  const points = (ledgerRes.data ?? []).reduce(
    (sum: number, e: { delta: number }) => sum + e.delta,
    0
  );

  return {
    projects: projectsRes.count ?? 0,
    problems: problemsRes.count ?? 0,
    solvers: solvers.size,
    points,
  };
}

/**
 * 把草稿正文写进 Storage，返回要落到表里的路径与语种。
 *
 * 表单目前只收英文正文；将来加中文输入框时这里天然支持——
 * 只要 draft.content 里带上 zh，就会多写一个 zh.md。
 */
async function persistContent(
  slug: string,
  content: ProjectDraft["content"]
): Promise<{ content_path: string; content_locales: AppLocale[] }> {
  const path = contentPathFor(slug);
  const locales: AppLocale[] = [];
  for (const locale of ["en", "zh"] as AppLocale[]) {
    const md = content?.[locale]?.trim();
    if (!md) continue;
    await putProjectContent(path, locale, md);
    locales.push(locale);
  }
  return { content_path: path, content_locales: locales };
}

function challengeSyncCols(draft: ProjectDraft) {
  return draft.type === "challenge"
    ? {
        sync_commit: draft.sync_commit || null,
        sync_branch: draft.sync_branch || null,
        sync_path: draft.sync_path || null,
      }
    : { sync_commit: null, sync_branch: null, sync_path: null };
}

export async function createProject(
  draft: ProjectDraft,
  ownerId: string
): Promise<Project> {
  if (useMock()) return mock.createProject(draft, ownerId);

  const supabase = await createClient();
  const baseSlug = slugify(draft.title.en);
  let slug = baseSlug;
  for (let i = 1; i <= 20; i++) {
    const { data } = await supabase
      .from("projects")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${i}`;
  }

  const contentCols = await persistContent(slug, draft.content);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      slug,
      owner_id: ownerId,
      type: draft.type,
      title: draft.title,
      summary: draft.summary,
      ...contentCols,
      repo_url: draft.repo_url,
      default_branch: draft.default_branch || "main",
      difficulty: draft.difficulty,
      tags: draft.tags,
      status: "published",
      ...challengeSyncCols(draft),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  slug: string,
  draft: ProjectDraft
): Promise<Project> {
  if (useMock()) return mock.updateProject(slug, draft);

  const supabase = await createClient();
  const contentCols = await persistContent(slug, draft.content);

  const { data, error } = await supabase
    .from("projects")
    .update({
      type: draft.type,
      title: draft.title,
      summary: draft.summary,
      ...contentCols,
      repo_url: draft.repo_url,
      default_branch: draft.default_branch || "main",
      difficulty: draft.difficulty,
      tags: draft.tags,
      ...challengeSyncCols(draft),
    })
    .eq("slug", slug)
    .select("*")
    .single();

  if (error) throw error;
  return data as Project;
}

/** Compute the current user's relationship to a project for edit/claim UI. */
export async function getProjectAccess(
  slug: string,
  userId: string | null
): Promise<{
  isOwner: boolean;
  isMaintainer: boolean;
  canClaim: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
}> {
  if (!userId) {
    return {
      isOwner: false,
      isMaintainer: false,
      canClaim: false,
      isAdmin: false,
      canEdit: false,
      canDelete: false,
    };
  }
  if (useMock()) return mock.getProjectAccess(slug, userId);

  // Bootstrap the first admin(s) from INITIAL_ADMIN_LOGINS on authenticated hits.
  await ensureInitialAdmins();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, repo_url, owner_id, managed_by_sync")
    .eq("slug", slug)
    .maybeSingle();
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

  const { data: adminRow } = await supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  const isAdmin = !!adminRow;

  const isOwner = project.owner_id === userId;
  let isMaintainer = false;
  if (!isOwner) {
    const { count } = await supabase
      .from("project_members")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("user_id", userId);
    isMaintainer = (count ?? 0) > 0;
  }

  let canClaim = false;
  if (!isOwner && !isMaintainer && !isAdmin) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("github_login")
      .eq("id", userId)
      .maybeSingle();
    const login = profile?.github_login?.toLowerCase() ?? null;
    const repoOwner = parseGithubOwner(project.repo_url);
    canClaim = !!login && !!repoOwner && login === repoOwner;
  }

  const canEdit = isOwner || isMaintainer || isAdmin;
  const canDelete = (isOwner || isAdmin) && !project.managed_by_sync;

  return { isOwner, isMaintainer, canClaim, isAdmin, canEdit, canDelete };
}

/** List the maintainers (besides the owner) of a project. */
export async function listMaintainers(
  projectId: string
): Promise<ProjectMaintainer[]> {
  if (useMock()) return mock.listMaintainers(projectId);

  const supabase = await createClient();
  // NOTE: project_members.user_id references auth.users (not profiles), so a
  // `profiles(...)` embedded-select would fail with a PostgREST "could not find
  // a relationship" 400. Resolve members, then fetch the profiles separately.
  const { data: members, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  if (error) throw error;
  const userIds = (members ?? []).map((m) => (m as { user_id: string }).user_id);
  if (userIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, github_login, display_name")
    .in("id", userIds);
  if (pErr) throw pErr;

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      (p as { id: string }).id,
      p as { id: string; github_login: string; display_name: string },
    ])
  );
  return userIds.map((uid) => {
    const p = profileMap.get(uid);
    return {
      user_id: uid,
      github_login: p?.github_login ?? "unknown",
      display_name: p?.display_name ?? "Unknown",
    };
  });
}

/** Claim a project: verify the caller's GitHub login owns the repo, then add
 *  them as a maintainer. Owners are already editors, so this is a no-op for them. */
export async function claimProject(
  slug: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (useMock()) return mock.claimProject(slug, userId);

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, repo_url, owner_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return { ok: false, error: "not_found" };
  if (project.owner_id === userId) return { ok: true };

  const { data: profile } = await supabase
    .from("profiles")
    .select("github_login")
    .eq("id", userId)
    .maybeSingle();
  const login = profile?.github_login?.toLowerCase() ?? null;
  const repoOwner = parseGithubOwner(project.repo_url);
  if (!login || !repoOwner || login !== repoOwner) {
    return { ok: false, error: "not_owner" };
  }

  const { error } = await supabase.from("project_members").upsert(
    { project_id: project.id, user_id: userId, role: "maintainer" },
    { onConflict: "project_id,user_id" }
  );
  if (error) return { ok: false, error: "db" };
  return { ok: true };
}

/**
 * Delete a project. Deletion is permitted only when the caller owns it OR is an
 * admin, AND the project is not `managed_by_sync` (official / sync-imported
 * content is delete-protected — only the sync script / service_role may remove it).
 * The RLS `projects_delete_self` policy enforces this server-side as well.
 */
export async function deleteProject(
  slug: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (useMock()) return mock.deleteProject(slug, userId);

  const access = await getProjectAccess(slug, userId);
  if (!access.canDelete) return { ok: false, error: "permissionDenied" };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("slug", slug);
  if (error) return { ok: false, error: "db" };
  return { ok: true };
}
