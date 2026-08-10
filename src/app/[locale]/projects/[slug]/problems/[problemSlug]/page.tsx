import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, ArrowLeft, Trophy, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FallbackNotice } from "@/components/badges";
import { LeanCode } from "@/components/lean-code";
import { RichText } from "@/components/markdown";
import { SubmissionPanel } from "@/components/submission-panel";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/card";
import { getProblem, listSubmissionsForProblem, useMock } from "@/lib/mock/db";
import { resolveText } from "@/lib/i18n-content";
import { createClient } from "@/lib/supabase/server";
import type { AppLocale } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; problemSlug: string }>;
}) {
  const { locale, slug, problemSlug } = await params;
  const problem = await getProblem(slug, problemSlug);
  if (!problem) return {};
  return { title: resolveText(problem.title, locale as AppLocale).value };
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; problemSlug: string }>;
}) {
  const { locale, slug, problemSlug } = await params;
  setRequestLocale(locale);
  const loc = locale as AppLocale;

  const problem = await getProblem(slug, problemSlug);
  if (!problem) notFound();

  const t = await getTranslations("problem");
  const tc = await getTranslations("common");
  const tp = await getTranslations("project");

  const authUser = useMock()
    ? null
    : (await (await createClient()).auth.getUser()).data.user;
  const submissions = authUser
    ? await listSubmissionsForProblem(problem.id, authUser.id)
    : [];

  const title = resolveText(problem.title, loc);
  const statement = resolveText(problem.statement, loc);
  const projectTitle = resolveText(problem.project.title, loc);

  return (
    <div className="space-y-8">
      <Link
        href={`/projects/${problem.project.slug}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" />
        {tc("backTo", { target: projectTitle.value })}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="gold">
            <Trophy className="size-3" />
            {problem.bonus_points} {t("bonus")}
          </Badge>
          <Badge tone="neutral">
            <Users className="size-3" />
            {tp("solvedBy", { count: problem.solver_count })}
          </Badge>
          {problem.requires_manual_review && (
            <Badge tone="pending">
              <AlertTriangle className="size-3" />
              {t("manualReview")}
            </Badge>
          )}
        </div>
        <h1 className="text-[26px] leading-tight sm:text-[30px]">
          {title.value}
        </h1>
      </header>

      {problem.requires_manual_review && (
        <p className="rounded-xl border border-pending/30 bg-pending-soft px-5 py-3.5 text-[13px] leading-relaxed text-pending">
          {t("manualReviewBody")}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-10">
          <Section title={t("statement")}>
            {statement.isFallback && <FallbackNotice />}
            <RichText>{statement.value}</RichText>
          </Section>

          <Section title={t("challengeFile")}>
            <LeanCode
              source={problem.challenge_lean_source}
              filename={problem.challenge_lean_path}
            />
          </Section>

          <SubmissionPanel
            problemId={problem.id}
            initial={submissions}
            templates={problem.submission_templates ?? { "Submission.lean": "" }}
            submissionEnabled={problem.submission_enabled ?? false}
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-rule bg-card px-5 py-4">
            <h2 className="mb-3 font-serif text-[15px]">{t("config")}</h2>
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="mb-1 text-ink-faint">{t("theoremNames")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {problem.theorem_names.map((n) => (
                    <code
                      key={n}
                      className="rounded border border-rule bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-ink"
                    >
                      {n}
                    </code>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-ink-faint">{t("permittedAxioms")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {problem.permitted_axioms.map((a) => (
                    <code
                      key={a}
                      className="rounded border border-rule bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-ink"
                    >
                      {a}
                    </code>
                  ))}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">{t("definitionHoles")}</dt>
                <dd className="font-mono text-[12px] text-ink">
                  {problem.definition_names.length > 0
                    ? problem.definition_names.join(", ")
                    : tc("none")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">{t("nanoda")}</dt>
                <dd className="text-ink">
                  {problem.enable_nanoda ? t("enabled") : t("disabled")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-rule bg-card px-5 py-4">
            <h2 className="mb-3 font-serif text-[15px]">{t("solvers")}</h2>
            {problem.solvers.length === 0 ? (
              <p className="text-[13px] text-ink-faint">{t("noSolvers")}</p>
            ) : (
              <ul className="space-y-1.5 text-[13px]">
                {problem.solvers.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-[10px] font-medium text-accent">
                      {s.display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-ink">@{s.github_login}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
