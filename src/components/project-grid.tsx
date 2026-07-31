"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { resolveText } from "@/lib/i18n-content";
import type {
  AppLocale,
  Difficulty,
  ProjectListItem,
  ProjectType,
} from "@/lib/types";

type SortKey = "recent" | "popular" | "points" | "title";

const DIFFICULTIES: Difficulty[] = [
  "intro",
  "easy",
  "medium",
  "hard",
  "research",
];

/**
 * Filtering happens in memory for phase 1. Phase 2 pushes these predicates
 * down into the Postgres query and keeps the same prop surface.
 */
export function ProjectGrid({
  projects,
  tags,
}: {
  projects: ProjectListItem[];
  tags: string[];
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("filters");
  const tc = useTranslations("common");
  const tt = useTranslations("projectType");
  const td = useTranslations("difficulty");

  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<ProjectType | "">("");
  const [difficulty, setDifficulty] = React.useState<Difficulty | "">("");
  const [tag, setTag] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("recent");

  const hasFilters =
    query !== "" || type !== "" || difficulty !== "" || tag !== "";

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = projects.filter((p) => {
      if (type && p.type !== type) return false;
      if (difficulty && p.difficulty !== difficulty) return false;
      if (tag && !p.tags.includes(tag)) return false;
      if (!needle) return true;
      const haystack = [
        resolveText(p.title, locale).value,
        resolveText(p.summary, locale).value,
        p.title.en,
        p.summary.en,
        ...p.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    const sorted = [...filtered];
    switch (sort) {
      case "popular":
        sorted.sort((a, b) => b.solver_count - a.solver_count);
        break;
      case "points":
        sorted.sort((a, b) => b.total_bonus_points - a.total_bonus_points);
        break;
      case "title":
        sorted.sort((a, b) =>
          resolveText(a.title, locale).value.localeCompare(
            resolveText(b.title, locale).value,
            locale
          )
        );
        break;
      default:
        sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return sorted;
  }, [projects, query, type, difficulty, tag, sort, locale]);

  function reset() {
    setQuery("");
    setType("");
    setDifficulty("");
    setTag("");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-rule bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tc("searchPlaceholder")}
            aria-label={tc("search")}
            className="h-10 pl-9"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={tc("clear")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="f-type">{t("type")}</Label>
            <Select
              id="f-type"
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType | "")}
            >
              <option value="">{tc("all")}</option>
              <option value="normal">{tt("normal")}</option>
              <option value="challenge">{tt("challenge")}</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-diff">{t("difficulty")}</Label>
            <Select
              id="f-diff"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
            >
              <option value="">{tc("all")}</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {td(d)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-tag">{t("tag")}</Label>
            <Select
              id="f-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">{tc("all")}</option>
              {tags.map((tg) => (
                <option key={tg} value={tg}>
                  {tg}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-sort">{t("sort")}</Label>
            <Select
              id="f-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="recent">{t("sortRecent")}</option>
              <option value="popular">{t("sortPopular")}</option>
              <option value="points">{t("sortPoints")}</option>
              <option value="title">{t("sortTitle")}</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {t("resultCount", { count: visible.length })}
        </p>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset}>
            {t("reset")}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rule-strong px-6 py-14 text-center">
          <p className="font-serif text-[17px] text-ink">{t("empty")}</p>
          <p className="mt-1 text-[13px] text-ink-faint">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
