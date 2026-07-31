"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Github, Info, Loader2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { formatDateTime, formatDuration, shortSha } from "@/lib/utils";
import type { Submission } from "@/lib/types";

const REPO_RE = /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+?(?:\.git)?\/?$/;
const SHA_RE = /^[0-9a-fA-F]{40}$/;

type Errors = Partial<Record<"repo" | "sha" | "path", string>>;

function durationOf(s: Submission) {
  if (!s.started_at || !s.finished_at) return null;
  return Math.round(
    (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 1000
  );
}

export function SubmissionPanel({
  problemId,
  initial,
  requiresManualReview,
}: {
  problemId: string;
  initial: Submission[];
  requiresManualReview: boolean;
}) {
  const t = useTranslations("submission");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { user, signIn } = useSession();

  const [rows, setRows] = React.useState<Submission[]>(initial);
  const [repo, setRepo] = React.useState("");
  const [sha, setSha] = React.useState("");
  const [path, setPath] = React.useState("Solution.lean");
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    if (!repo.trim()) next.repo = t("errRepoRequired");
    else if (!REPO_RE.test(repo.trim())) next.repo = t("errRepoFormat");

    if (!sha.trim()) next.sha = t("errShaRequired");
    else if (!SHA_RE.test(sha.trim())) next.sha = t("errShaFormat");

    const p = path.trim();
    if (!p) next.path = t("errPathRequired");
    else if (!p.endsWith(".lean") || p.includes("..") || p.startsWith("/"))
      next.path = t("errPathFormat");

    return next;
  }

  function patch(id: string, changes: Partial<Submission>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...changes } : r))
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !user) return;

    setBusy(true);
    const id = `local_${Date.now()}`;
    const now = new Date().toISOString();

    const draft: Submission = {
      id,
      problem_id: problemId,
      user_id: user.id,
      repo_url: repo.trim(),
      commit_sha: sha.trim().toLowerCase(),
      solution_path: path.trim(),
      status: "queued",
      verdict: null,
      log_url: null,
      runner_run_id: null,
      points_awarded: 0,
      created_at: now,
      started_at: null,
      finished_at: null,
    };

    setRows((prev) => [draft, ...prev]);
    setNotice(t("queuedToast"));
    setBusy(false);

    // Simulated verification timeline. Phase 3 replaces this with a real
    // enqueue call plus Realtime status updates from the runner.
    timers.current.push(
      setTimeout(() => {
        patch(id, { status: "running", started_at: new Date().toISOString() });
      }, 1200)
    );

    const passes = parseInt(draft.commit_sha.slice(-1), 16) % 2 === 0;
    timers.current.push(
      setTimeout(() => {
        const finished = new Date().toISOString();
        if (!passes) {
          patch(id, {
            status: "failed",
            finished_at: finished,
            verdict: {
              ok: false,
              stage: "declaration_match",
              message:
                "Solution declares a different statement than Challenge (simulated result).",
            },
          });
          return;
        }
        patch(id, {
          status: requiresManualReview ? "review" : "passed",
          finished_at: finished,
          points_awarded: 0,
          verdict: {
            ok: true,
            stage: "done",
            message: requiresManualReview
              ? "Verification passed; queued for manual review (simulated result)."
              : "Declarations match Challenge. Kernel replay accepted (simulated result).",
            axioms_used: ["propext", "Classical.choice"],
          },
        });
      }, 5200)
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-rule bg-card">
        <div className="border-b border-rule px-5 py-3">
          <h3 className="font-serif text-[17px]">{t("heading")}</h3>
        </div>

        {!user ? (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-[13.5px] text-ink-muted">{t("signInPrompt")}</p>
            <Button size="sm" onClick={signIn}>
              <Github className="size-4" />
              {tNav("signIn")}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 px-5 py-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="repo">{t("repoUrl")}</Label>
              <Input
                id="repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="https://github.com/you/solutions"
                aria-invalid={Boolean(errors.repo)}
                className="font-mono text-[13px]"
              />
              {errors.repo ? (
                <FieldError>{errors.repo}</FieldError>
              ) : (
                <FieldHint>{t("repoUrlHint")}</FieldHint>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sha">{t("commitSha")}</Label>
                <Input
                  id="sha"
                  value={sha}
                  onChange={(e) => setSha(e.target.value)}
                  placeholder="0123456789abcdef…"
                  aria-invalid={Boolean(errors.sha)}
                  className="font-mono text-[13px]"
                />
                {errors.sha ? (
                  <FieldError>{errors.sha}</FieldError>
                ) : (
                  <FieldHint>{t("commitShaHint")}</FieldHint>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="path">{t("solutionPath")}</Label>
                <Input
                  id="path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="Solution.lean"
                  aria-invalid={Boolean(errors.path)}
                  className="font-mono text-[13px]"
                />
                {errors.path ? (
                  <FieldError>{errors.path}</FieldError>
                ) : (
                  <FieldHint>{t("solutionPathHint")}</FieldHint>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? t("submitting") : t("submit")}
              </Button>
              {notice && (
                <span className="text-[12.5px] text-verify">{notice}</span>
              )}
            </div>

            <p className="flex items-start gap-1.5 rounded-md border border-rule bg-surface-2 px-3 py-2 text-[12px] text-ink-faint">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t("mockNotice")}
            </p>
          </form>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-serif text-[17px]">{t("history")}</h3>
        {!user || rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-rule-strong px-5 py-8 text-center text-[13px] text-ink-faint">
            {t("noHistory")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-rule bg-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-rule bg-surface-2 text-left text-[12px] text-ink-muted">
                  <th className="px-4 py-2 font-medium">{t("colSubmitted")}</th>
                  <th className="px-4 py-2 font-medium">{t("colCommit")}</th>
                  <th className="px-4 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-4 py-2 font-medium">{t("colDuration")}</th>
                  <th className="px-4 py-2 font-medium">{t("colPoints")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className="border-b border-rule last:border-b-0">
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">
                        {formatDateTime(s.created_at, locale)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px]">
                        {shortSha(s.commit_sha)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">
                        {formatDuration(durationOf(s))}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {s.points_awarded > 0 ? `+${s.points_awarded}` : "—"}
                      </td>
                    </tr>
                    {s.verdict && (
                      <tr className="border-b border-rule last:border-b-0">
                        <td colSpan={5} className="px-4 pb-3">
                          <p className="rounded-md border border-rule bg-surface-3 px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-muted">
                            <span className="text-ink-faint">
                              [{s.verdict.stage}]{" "}
                            </span>
                            {s.verdict.message}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
