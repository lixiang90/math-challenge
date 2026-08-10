"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Github, Info, Loader2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { StatusBadge } from "@/components/badges";
import { SubmissionEditor } from "@/components/submission-editor";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { validateSolutionFiles, type SolutionFiles } from "@/lib/lean-paths";
import type { Submission } from "@/lib/types";

const TERMINAL = new Set(["passed", "failed", "error", "timeout", "review"]);

function durationOf(s: Submission) {
  if (!s.started_at || !s.finished_at) return null;
  return Math.round(
    (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 1000,
  );
}

export function SubmissionPanel({
  problemId,
  initial,
  templates,
  submissionEnabled,
}: {
  problemId: string;
  initial: Submission[];
  templates: SolutionFiles;
  submissionEnabled: boolean;
}) {
  const t = useTranslations("submission");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { user, signIn } = useSession();
  const storageKey = `math-challenge:submission-draft:${problemId}`;

  const [rows, setRows] = React.useState<Submission[]>(initial);
  const [files, setFiles] = React.useState<SolutionFiles>(templates);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validation = validateSolutionFiles(parsed);
        if (validation.ok) setFiles(validation.files);
      }
    } catch {
      // Corrupt/blocked localStorage should not prevent editing.
    }
  }, [storageKey]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(files));
      } catch {
        // Draft persistence is best-effort.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [files, storageKey]);

  const activeIds = rows.filter((row) => !TERMINAL.has(row.status)).map((row) => row.id);
  React.useEffect(() => {
    if (!user || activeIds.length === 0) return;
    let cancelled = false;
    const poll = async () => {
      const updates = await Promise.all(
        activeIds.map(async (id) => {
          const response = await fetch(`/api/submissions/${id}`, { cache: "no-store" });
          if (!response.ok) return null;
          const payload = (await response.json()) as { submission?: Submission };
          return payload.submission ?? null;
        }),
      );
      if (!cancelled) {
        const byId = new Map(updates.filter(Boolean).map((row) => [row!.id, row!]));
        setRows((previous) => previous.map((row) => byId.get(row.id) ?? row));
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user, activeIds.join(",")]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    const validation = validateSolutionFiles(files);
    if (!validation.ok) {
      setError(validation.errors[0] ?? "Invalid submission files.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_id: problemId, files: validation.files }),
      });
      const payload = (await response.json()) as {
        submission?: Submission;
        error?: string;
        details?: string[];
      };
      if (!response.ok || !payload.submission) {
        throw new Error(payload.details?.[0] || payload.error || "Unable to submit.");
      }
      setRows((previous) => [payload.submission!, ...previous]);
      setNotice(t("queuedToast"));
      localStorage.removeItem(storageKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit.");
    } finally {
      setBusy(false);
    }
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
            <Button size="sm" onClick={() => void signIn()}>
              <Github className="size-4" />
              {tNav("signIn")}
            </Button>
          </div>
        ) : !submissionEnabled ? (
          <p className="px-5 py-6 text-[13px] text-ink-muted">{t("disabled")}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 px-5 py-5" noValidate>
            <SubmissionEditor files={files} onChange={setFiles} disabled={busy} />
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" disabled={busy || !validateSolutionFiles(files).ok}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? t("submitting") : t("submit")}
              </Button>
              {notice && <span className="text-[12.5px] text-verify">{notice}</span>}
              {error && <span role="alert" className="text-[12.5px] text-fail">{error}</span>}
            </div>
            <p className="flex items-start gap-1.5 rounded-md border border-rule bg-surface-2 px-3 py-2 text-[12px] text-ink-faint">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t("realNotice")}
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
                {rows.map((submission) => (
                  <React.Fragment key={submission.id}>
                    <tr className="border-b border-rule last:border-b-0">
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">
                        {formatDateTime(submission.created_at, locale)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px]">
                        {submission.benchmark_commit?.slice(0, 8) ?? submission.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={submission.status} /></td>
                      <td className="px-4 py-2.5 text-ink-muted">
                        {formatDuration(durationOf(submission))}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {submission.points_awarded > 0 ? `+${submission.points_awarded}` : "—"}
                      </td>
                    </tr>
                    {(submission.verdict || submission.error_message) && (
                      <tr className="border-b border-rule last:border-b-0">
                        <td colSpan={5} className="px-4 pb-3">
                          <p className="rounded-md border border-rule bg-surface-3 px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-muted">
                            <span className="text-ink-faint">[{submission.verdict?.stage ?? "error"}] </span>
                            {submission.verdict?.message ?? submission.error_message}
                            {submission.log_url && (
                              <a className="ml-2 inline-flex items-center gap-1 text-accent" href={submission.log_url} target="_blank" rel="noreferrer">
                                {t("logs")} <ExternalLink className="size-3" />
                              </a>
                            )}
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
