"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
} from "@/components/ui/field";
import {
  createProjectAction,
  updateProjectAction,
  type ProjectFormState,
} from "@/app/actions/project-actions";
import type { ProjectDetail, ProjectType } from "@/lib/types";

const DIFFICULTIES = ["intro", "easy", "medium", "hard", "research"] as const;

const initialState: ProjectFormState = { ok: false };

export function ProjectForm({
  locale,
  mode,
  slug,
  project,
}: {
  locale: string;
  mode: "create" | "edit";
  slug?: string;
  project?: ProjectDetail | null;
}) {
  const t = useTranslations("projectForm");
  const td = useTranslations("difficulty");
  const tp = useTranslations("projectType");

  const [type, setType] = React.useState<ProjectType>(
    project?.type ?? "normal"
  );

  const action = React.useCallback(
    (prev: ProjectFormState, fd: FormData) =>
      mode === "create"
        ? createProjectAction(prev, fd)
        : updateProjectAction(slug as string, prev, fd),
    [mode, slug]
  );

  const [state, formAction, isPending] = React.useActionState(action, initialState);

  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? t(`errors.${state.fieldErrors[name]}`) : null;

  const textareaClass =
    "min-h-[140px] w-full rounded-md border border-rule-strong bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-fail";

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="type" value={type} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-fail/40 bg-fail/10 px-4 py-3 text-[13px] text-fail"
        >
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      {/* Type */}
      <fieldset>
        <Label>{t("typeLabel")}</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["normal", "challenge"] as ProjectType[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              aria-pressed={type === value}
              className={
                "rounded-lg border px-4 py-3 text-left transition-colors " +
                (type === value
                  ? "border-accent bg-accent-soft"
                  : "border-rule-strong hover:border-ink-faint")
              }
            >
              <span className="block text-[14px] font-medium text-ink">
                {value === "normal" ? tp("normal") : tp("challenge")}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">
                {value === "normal" ? tp("normalHint") : tp("challengeHint")}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Titles */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="titleEn">{t("titleEn")}</Label>
          <Input
            id="titleEn"
            name="titleEn"
            required
            defaultValue={project?.title?.en ?? ""}
            className="mt-1.5"
            aria-invalid={!!fieldError("titleEn")}
          />
          {fieldError("titleEn") ? (
            <FieldError className="mt-1">{fieldError("titleEn")}</FieldError>
          ) : (
            <FieldHint className="mt-1">{t("titleEnHint")}</FieldHint>
          )}
        </div>
        <div>
          <Label htmlFor="titleZh">{t("titleZh")}</Label>
          <Input
            id="titleZh"
            name="titleZh"
            defaultValue={project?.title?.zh ?? ""}
            className="mt-1.5"
          />
          <FieldHint className="mt-1">{t("titleZhHint")}</FieldHint>
        </div>
      </div>

      {/* Summaries */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="summaryEn">{t("summaryEn")}</Label>
          <Input
            id="summaryEn"
            name="summaryEn"
            defaultValue={project?.summary?.en ?? ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="summaryZh">{t("summaryZh")}</Label>
          <Input
            id="summaryZh"
            name="summaryZh"
            defaultValue={project?.summary?.zh ?? ""}
            className="mt-1.5"
          />
        </div>
      </div>
      <FieldHint>{t("summaryHint")}</FieldHint>

      {/* Body content (stored per-locale in Supabase Storage) */}
      <div>
        <Label htmlFor="contentEn">{t("descriptionEn")}</Label>
        <textarea
          id="contentEn"
          name="contentEn"
          defaultValue={project?.content?.value ?? ""}
          className={`${textareaClass} mt-1.5`}
        />
        <FieldHint className="mt-1">{t("descriptionEnHint")}</FieldHint>
      </div>

      {/* Repo + branch */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="repoUrl">{t("repoUrl")}</Label>
          <Input
            id="repoUrl"
            name="repoUrl"
            required
            placeholder="https://github.com/user/repo"
            defaultValue={project?.repo_url ?? ""}
            className="mt-1.5"
            aria-invalid={!!fieldError("repoUrl")}
          />
          {fieldError("repoUrl") ? (
            <FieldError className="mt-1">{fieldError("repoUrl")}</FieldError>
          ) : (
            <FieldHint className="mt-1">{t("repoUrlHint")}</FieldHint>
          )}
        </div>
        <div>
          <Label htmlFor="defaultBranch">{t("defaultBranch")}</Label>
          <Input
            id="defaultBranch"
            name="defaultBranch"
            defaultValue={project?.default_branch ?? "main"}
            className="mt-1.5"
          />
          <FieldHint className="mt-1">{t("defaultBranchHint")}</FieldHint>
        </div>
      </div>

      {/* Difficulty + tags */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="difficulty">{t("difficulty")}</Label>
          <Select
            id="difficulty"
            name="difficulty"
            defaultValue={project?.difficulty ?? "intro"}
            className="mt-1.5"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {td(d)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="tags">{t("tags")}</Label>
          <Input
            id="tags"
            name="tags"
            defaultValue={(project?.tags ?? []).join(", ")}
            className="mt-1.5"
          />
          <FieldHint className="mt-1">{t("tagsHint")}</FieldHint>
        </div>
      </div>

      {/* Challenge sync settings */}
      {type === "challenge" ? (
        <fieldset className="rounded-xl border border-rule bg-surface-2/40 p-5">
          <legend className="px-1 text-[13px] font-medium text-ink">
            {t("syncHeading")}
          </legend>
          <FieldHint className="mb-4 -mt-1">{t("syncHint")}</FieldHint>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="syncCommit">{t("syncCommit")}</Label>
              <Input
                id="syncCommit"
                name="syncCommit"
                placeholder="e.g. a1b2c3… (40 hex)"
                defaultValue={project?.sync_commit ?? ""}
                className="mt-1.5 font-mono"
                aria-invalid={!!fieldError("syncCommit")}
              />
              {fieldError("syncCommit") ? (
                <FieldError className="mt-1">{fieldError("syncCommit")}</FieldError>
              ) : (
                <FieldHint className="mt-1">{t("syncCommitHint")}</FieldHint>
              )}
            </div>
            <div>
              <Label htmlFor="syncBranch">{t("syncBranch")}</Label>
              <Input
                id="syncBranch"
                name="syncBranch"
                placeholder={project?.default_branch ?? "main"}
                defaultValue={project?.sync_branch ?? ""}
                className="mt-1.5"
              />
              <FieldHint className="mt-1">{t("syncBranchHint")}</FieldHint>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="syncPath">{t("syncPath")}</Label>
              <Input
                id="syncPath"
                name="syncPath"
                placeholder="e.g. challenge/ or src/"
                defaultValue={project?.sync_path ?? ""}
                className="mt-1.5"
                aria-invalid={!!fieldError("syncPath")}
              />
              {fieldError("syncPath") ? (
                <FieldError className="mt-1">{fieldError("syncPath")}</FieldError>
              ) : (
                <FieldHint className="mt-1">{t("syncPathHint")}</FieldHint>
              )}
            </div>
          </div>
        </fieldset>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? t("submitting")
            : mode === "create"
              ? t("submit")
              : t("update")}
        </Button>
        <Button asChild variant="outline">
          <Link href={mode === "edit" && slug ? `/projects/${slug}` : "/"}>
            {t("cancel")}
          </Link>
        </Button>
      </div>
    </form>
  );
}
