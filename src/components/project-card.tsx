"use client";

import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, ListChecks, Trophy, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { DifficultyBadge, TypeBadge } from "@/components/badges";
import { resolveText } from "@/lib/i18n-content";
import type { AppLocale, ProjectListItem } from "@/lib/types";

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("project");
  const tc = useTranslations("common");

  const title = resolveText(project.title, locale);
  const summary = resolveText(project.summary, locale);

  return (
    <Card className="flex h-full flex-col hover:border-rule-strong">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={project.type} />
          <DifficultyBadge level={project.difficulty} />
        </div>

        <div className="space-y-1.5">
          <h3 className="font-serif text-[17px] leading-snug">
            <Link
              href={`/projects/${project.slug}`}
              className="transition-colors hover:text-accent"
            >
              {title.value}
            </Link>
          </h3>
          <p className="line-clamp-3 text-[13.5px] leading-relaxed text-ink-muted">
            {summary.value}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {project.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded border border-rule bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-faint"
            >
              {tag}
            </span>
          ))}
        </div>
      </CardBody>

      <CardFooter className="justify-between text-[12px] text-ink-muted">
        <div className="flex items-center gap-3">
          {project.type === "challenge" ? (
            <>
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3.5" />
                {t("problemCount", { count: project.problem_count })}
              </span>
              <span className="inline-flex items-center gap-1 text-gold">
                <Trophy className="size-3.5" />
                {t("totalPoints", { points: project.total_bonus_points })}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />@{project.owner.github_login}
            </span>
          )}
        </div>
        <a
          href={project.repo_url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={tc("openInGitHub")}
          className="inline-flex items-center gap-1 transition-colors hover:text-accent"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </CardFooter>
    </Card>
  );
}
