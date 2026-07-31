import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectGrid } from "@/components/project-grid";
import { getSiteStats, listAllTags, listProjects } from "@/lib/mock/db";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const [projects, tags, stats] = await Promise.all([
    listProjects(),
    listAllTags(),
    getSiteStats(),
  ]);

  const cells = [
    { value: stats.projects, label: t("statProjects") },
    { value: stats.problems, label: t("statProblems") },
    { value: stats.solvers, label: t("statSolvers") },
    { value: stats.points, label: t("statPoints") },
  ];

  return (
    <div className="space-y-10">
      <section className="max-w-2xl">
        <h1 className="text-[30px] leading-tight sm:text-[36px]">
          {t("heroTitle")}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          {t("heroBody")}
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="bg-card px-5 py-4">
            <dt className="text-[12px] tracking-wide text-ink-faint uppercase">
              {c.label}
            </dt>
            <dd className="mt-0.5 font-serif text-[26px] leading-none">
              {c.value}
            </dd>
          </div>
        ))}
      </dl>

      <ProjectGrid projects={projects} tags={tags} />
    </div>
  );
}
