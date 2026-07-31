import type {
  ChallengeProblem,
  LeaderboardRow,
  ProblemDetail,
  ProblemListItem,
  Profile,
  Project,
  ProjectDetail,
  ProjectListItem,
  Submission,
  SubmissionWithContext,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import * as mock from "./fallback";

/**
 * Phase-2 data layer.
 *
 * Uses real Supabase queries when credentials are configured; otherwise falls
 * back to the local mock data in `./fallback.ts`. The exported shapes are
 * identical in both modes, so pages/components do not need to change.
 */

function useMock(): boolean {
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

export async function getProjectBySlug(
  slug: string
): Promise<ProjectDetail | null> {
  if (useMock()) return mock.getProjectBySlug(slug);

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

  return {
    ...(project as Project),
    owner: profileMap.get(project.owner_id)!,
    problem_count: own.length,
    total_bonus_points: own.reduce((sum, p) => sum + p.bonus_points, 0),
    solver_count: solverIds.size,
    problems: own,
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

export async function listSubmissionsForProblem(
  problemId: string,
  userId: string
): Promise<Submission[]> {
  if (useMock()) return mock.listSubmissionsForProblem(problemId, userId);

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
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase
      .from("submissions")
      .select("status,problem_id")
      .eq("user_id", userId),
    supabase.from("projects").select("id").eq("owner_id", userId),
    supabase.from("points_ledger").select("delta").eq("user_id", userId),
  ]);

  if (profileRes.error) throw profileRes.error;
  const profile = profileRes.data as Profile;
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
