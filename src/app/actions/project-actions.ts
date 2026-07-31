"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProject, updateProject } from "@/lib/mock/db";
import { parseGithubTreeUrl } from "@/lib/utils";
import type {
  Difficulty,
  I18nText,
  ProjectDraft,
  ProjectType,
} from "@/lib/types";

export interface ProjectFormState {
  ok: boolean;
  /** Global error key under `projectForm.errors`. */
  error?: string;
  /** Field name -> error key under `projectForm.errors`. */
  fieldErrors?: Record<string, string>;
}

const DIFFICULTIES: Difficulty[] = [
  "intro",
  "easy",
  "medium",
  "hard",
  "research",
];

function parseDraft(formData: FormData):
  | { draft: ProjectDraft }
  | { fieldErrors: Record<string, string> } {
  const type: ProjectType =
    formData.get("type") === "challenge" ? "challenge" : "normal";
  const titleEn = (formData.get("titleEn") as string | null)?.trim() ?? "";
  const titleZh = (formData.get("titleZh") as string | null)?.trim() || undefined;
  const summaryEn = (formData.get("summaryEn") as string | null)?.trim() ?? "";
  const summaryZh =
    (formData.get("summaryZh") as string | null)?.trim() || undefined;
  const descriptionEn =
    (formData.get("descriptionEn") as string | null)?.trim() ?? "";
  const repoUrl = (formData.get("repoUrl") as string | null)?.trim() ?? "";
  const defaultBranch =
    (formData.get("defaultBranch") as string | null)?.trim() || "main";
  const difficultyRaw = formData.get("difficulty") as Difficulty | null;
  const difficulty: Difficulty = DIFFICULTIES.includes(difficultyRaw as Difficulty)
    ? (difficultyRaw as Difficulty)
    : "intro";
  const tagsRaw = (formData.get("tags") as string | null)?.trim() ?? "";
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const fieldErrors: Record<string, string> = {};
  if (!titleEn) fieldErrors.titleEn = "titleEn";
  if (!repoUrl) fieldErrors.repoUrl = "repoUrl";
  else {
    try {
      const u = new URL(repoUrl);
      if (u.protocol !== "https:" || !u.hostname || u.hostname === "example.com") {
        fieldErrors.repoUrl = "repoUrlFormat";
      }
    } catch {
      fieldErrors.repoUrl = "repoUrlFormat";
    }
  }

  // Smart-parse a repo URL that already points at /tree/{ref}/{path}.
  // The repo root is normalized; the embedded ref/path are used as a fallback
  // only when the dedicated fields below are left blank.
  const parsedTree = parseGithubTreeUrl(repoUrl);
  const baseRepoUrl = parsedTree ? parsedTree.base : repoUrl;
  const urlRef = parsedTree?.ref ?? null;
  const urlPath = parsedTree?.path ?? null;

  let sync_commit: string | null = null;
  let sync_branch: string | null = null;
  let sync_path: string | null = null;
  if (type === "challenge") {
    const commit = (formData.get("syncCommit") as string | null)?.trim() ?? "";
    const branch = (formData.get("syncBranch") as string | null)?.trim() ?? "";
    const path = (formData.get("syncPath") as string | null)?.trim() ?? "";

    if (commit) {
      if (!/^[0-9a-f]{40}$/i.test(commit)) fieldErrors.syncCommit = "commitFormat";
      else sync_commit = commit;
    }
    if (branch) sync_branch = branch;
    if (path) {
      if (path.startsWith("/") || path.includes("..") || !path.trim()) {
        fieldErrors.syncPath = "pathFormat";
      } else sync_path = path;
    }

    // Fall back to info embedded in the repo URL only when the field is blank.
    // Explicitly-filled fields below always win.
    if (!commit && !branch && urlRef) {
      if (/^[0-9a-f]{40}$/i.test(urlRef)) sync_commit = urlRef;
      else sync_branch = urlRef;
    }
    if (!path && urlPath) sync_path = urlPath;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const title: I18nText = titleZh ? { en: titleEn, zh: titleZh } : { en: titleEn };
  const summary: I18nText = summaryZh
    ? { en: summaryEn, zh: summaryZh }
    : { en: summaryEn };
  const description: I18nText = descriptionEn ? { en: descriptionEn } : { en: "" };

  return {
    draft: {
      type,
      title,
      summary,
      description,
      repo_url: baseRepoUrl,
      default_branch: defaultBranch,
      sync_commit,
      sync_branch,
      sync_path,
      difficulty,
      tags,
    },
  };
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const parsed = parseDraft(formData);
  if ("fieldErrors" in parsed) return { ok: false, fieldErrors: parsed.fieldErrors };

  let slug: string;
  try {
    const project = await createProject(parsed.draft, user.id);
    slug = project.slug;
  } catch (e) {
    console.error("[createProjectAction] failed to insert project:", e);
    return { ok: false, error: classifyError(e) };
  }

  const locale = (formData.get("locale") as string | null) || "en";
  redirect(`/${locale}/projects/${slug}`);
}

export async function updateProjectAction(
  slug: string,
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const parsed = parseDraft(formData);
  if ("fieldErrors" in parsed) return { ok: false, fieldErrors: parsed.fieldErrors };

  try {
    await updateProject(slug, user.id, parsed.draft);
  } catch (e) {
    console.error("[updateProjectAction] failed to update project:", e);
    return { ok: false, error: classifyError(e) };
  }

  const locale = (formData.get("locale") as string | null) || "en";
  redirect(`/${locale}/projects/${slug}`);
}

/**
 * Map a thrown database error to an actionable i18n key.
 * `redirect()` is never passed here (it is called outside the try/catch),
 * so every error reaching this function is a genuine failure.
 */
function classifyError(e: unknown): string {
  const err = e as { code?: string; message?: string; details?: string };
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  if (code === "42703" || msg.includes("does not exist") || msg.includes("column")) {
    return "schemaMissing";
  }
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission")) {
    return "permissionDenied";
  }
  if (code === "23505" || msg.includes("duplicate") || msg.includes("unique")) {
    return "duplicate";
  }
  return "generic";
}
