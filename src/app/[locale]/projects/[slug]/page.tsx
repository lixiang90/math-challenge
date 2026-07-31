import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ExternalLink, GitBranch, Pencil, Trophy, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DifficultyBadge, FallbackNotice, TypeBadge } from "@/components/badges";
import { Markdown, RichText } from "@/components/markdown";
import { FileTree } from "@/components/file-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { ClaimButton } from "@/components/claim-button";
import {
  getProjectAccess,
  getProjectBySlug,
  listMaintainers,
  useMock,
} from "@/lib/mock/db";
import { createClient } from "@/lib/supabase/server";
import { resolveText } from "@/lib/i18n-content";
import type { AppLocale, ProjectMaintainer } from "@/lib/types";
import { formatDate, githubRepoUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  // 元数据只用表内短字段，不必拉正文与文件树
  const project = await getProjectBySlug(slug, locale as AppLocale);
  if (!project) return {};
  return {
    title: resolveText(project.title, locale as AppLocale).value,
    description: resolveText(project.summary, locale as AppLocale).value,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loc = locale as AppLocale;

  const project = await getProjectBySlug(slug, loc, { withTree: true });
  if (!project) notFound();

  let canEdit = false;
  let canClaim = false;
  let maintainers: ProjectMaintainer[] = [];
  if (!useMock()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const access = await getProjectAccess(slug, user.id);
      canEdit = access.isOwner || access.isMaintainer;
      canClaim = access.canClaim;
    }
    maintainers = await listMaintainers(project.id);
  }

  const t = await getTranslations("project");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");
  const tp = await getTranslations("projectType");
  const tclaim = await getTranslations("claim");

  const title = resolveText(project.title, loc);
  const summary = resolveText(project.summary, loc);
  // 正文来自 Storage，getProjectBySlug 里已按语种解析并标好是否回退
  const content = project.content;

  const meta = [
    { label: t("author"), value: `@${project.owner.github_login}` },
    { label: t("branch"), value: project.default_branch, mono: true },
    { label: t("created"), value: formatDate(project.created_at, locale) },
    { label: t("updated"), value: formatDate(project.updated_at, locale) },
  ];

  const repoLink = githubRepoUrl({
    repoUrl: project.repo_url,
    type: project.type,
    defaultBranch: project.default_branch,
    syncBranch: project.sync_branch,
    syncCommit: project.sync_commit,
    syncPath: project.sync_path,
  });

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" />
        {tc("backTo", { target: tn("browse") })}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={project.type} />
          <DifficultyBadge level={project.difficulty} />
          {project.type === "challenge" && (
            <Badge tone="gold">
              <Trophy className="size-3" />
              {t("totalPoints", { points: project.total_bonus_points })}
            </Badge>
          )}
        </div>
        <h1 className="text-[28px] leading-tight sm:text-[32px]">
          {title.value}
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink-muted">
          {summary.value}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-10">
          {content.value && (
            <Section title={t("overview")}>
              {content.isFallback && <FallbackNotice />}
              <RichText>{content.value}</RichText>
            </Section>
          )}

          {project.type === "challenge" && (
            <Section
              title={t("problems")}
              action={
                <span className="text-[13px] text-ink-faint">
                  {t("problemCount", { count: project.problem_count })}
                </span>
              }
            >
              <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-card">
                {project.problems.map((problem) => {
                  const ptitle = resolveText(problem.title, loc);
                  return (
                    <li key={problem.id}>
                      <Link
                        href={`/projects/${project.slug}/problems/${problem.slug}`}
                        className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-3"
                      >
                        <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[13px] text-ink-faint">
                          {problem.order_index}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-ink">
                            {ptitle.value}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3" />
                              {t("solvedBy", { count: problem.solver_count })}
                            </span>
                            {problem.requires_manual_review && (
                              <Badge tone="gold">{tp("challenge")}</Badge>
                            )}
                          </span>
                        </span>
                        <Badge tone="gold" className="shrink-0">
                          +{problem.bonus_points}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {project.file_tree && project.file_tree.length > 0 && (
            <Section
              title={t("files")}
              action={
                <a
                  href={repoLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-ink-muted transition-colors hover:text-accent"
                >
                  {t("viewOnGithub")}
                </a>
              }
            >
              <FileTree nodes={project.file_tree} />
            </Section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-rule bg-card px-5 py-4">
            <h2 className="mb-3 font-serif text-[15px]">{t("about")}</h2>
            <dl className="space-y-2.5 text-[13px]">
              {meta.map((m) => (
                <div key={m.label} className="flex justify-between gap-3">
                  <dt className="text-ink-faint">{m.label}</dt>
                  <dd className={m.mono ? "font-mono text-ink" : "text-ink"}>
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <a
            href={repoLink}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-xl border border-rule bg-card px-5 py-3 text-[13px] transition-colors hover:border-accent hover:text-accent"
          >
            <GitBranch className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
              {project.repo_url.replace("https://", "")}
            </span>
            <ExternalLink className="size-3.5 shrink-0" />
          </a>

          {canEdit && (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/projects/${project.slug}/edit`}>
                <Pencil className="size-3.5" />
                {tn("editProject")}
              </Link>
            </Button>
          )}

          {canClaim && <ClaimButton slug={project.slug} locale={locale} />}

          {maintainers.length > 0 && (
            <div className="rounded-xl border border-rule bg-card px-5 py-4">
              <h2 className="mb-2 font-serif text-[15px]">{tclaim("title")}</h2>
              <ul className="space-y-1.5 text-[13px] text-ink-muted">
                {maintainers.map((m) => (
                  <li key={m.user_id} className="font-mono">
                    @{m.github_login}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-rule bg-card px-5 py-4">
            <h2 className="mb-2 font-serif text-[15px]">{t("tags")}</h2>
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-rule bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-faint"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
