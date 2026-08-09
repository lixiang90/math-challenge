import {
  ArrowRight,
  Braces,
  Check,
  CircleDot,
  Github,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectGrid } from "@/components/project-grid";
import { Link } from "@/i18n/navigation";
import { resolveText } from "@/lib/i18n-content";
import { getSiteStats, listAllTags, listProjects } from "@/lib/mock/db";
import type { AppLocale } from "@/lib/types";

const MILLENNIUM_ORDER = [
  "millennium_riemann_hypothesis",
  "millennium_p_versus_np",
  "millennium_navier_stokes",
  "millennium_yang_mills",
  "millennium_hodge_conjecture",
  "millennium_birch_swinnerton_dyer",
  "millennium_poincare_conjecture",
] as const;

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

  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  const millenniumProjects = MILLENNIUM_ORDER.flatMap((slug) => {
    const project = bySlug.get(slug);
    return project ? [project] : [];
  });

  const cells = [
    { value: stats.projects, label: t("statProjects") },
    { value: stats.problems, label: t("statProblems") },
    { value: stats.solvers, label: t("statSolvers") },
    { value: stats.points, label: t("statPoints") },
  ];

  const verificationSteps = [
    {
      icon: Braces,
      number: "01",
      title: t("stepWriteTitle"),
      body: t("stepWriteBody"),
    },
    {
      icon: LockKeyhole,
      number: "02",
      title: t("stepSubmitTitle"),
      body: t("stepSubmitBody"),
    },
    {
      icon: ShieldCheck,
      number: "03",
      title: t("stepVerifyTitle"),
      body: t("stepVerifyBody"),
    },
  ];

  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="relative overflow-hidden rounded-[28px] border border-rule bg-card px-5 py-7 shadow-[0_24px_80px_-48px_rgba(31,58,110,0.45)] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-gold-soft/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-accent-soft/70 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold-soft px-3 py-1 text-[12px] font-medium tracking-[0.08em] text-gold uppercase">
              <Trophy className="size-3.5" />
              {t("eyebrow")}
            </div>
            <h1 className="mt-6 max-w-3xl text-[38px] leading-[1.05] tracking-[-0.035em] sm:text-[52px] lg:text-[62px]">
              {t("heroTitle")}
              <span className="mt-1 block text-accent">{t("heroAccent")}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ink-muted sm:text-[17px]">
              {t("heroBody")}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#millennium"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {t("exploreMillennium")}
                <ArrowRight className="size-4" />
              </a>
              <a
                href="https://github.com/lixiang90/math-challenge-millennium"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rule-strong bg-card/80 px-5 text-[14px] font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
              >
                <Github className="size-4" />
                {t("viewStarterRepo")}
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink-muted">
              {[t("trustLean"), t("trustComparator"), t("trustSandbox")].map(
                (label) => (
                  <span key={label} className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-verify" />
                    {label}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[460px] lg:mx-0 lg:ml-auto">
            <div className="absolute -inset-3 rounded-[26px] border border-accent/10 bg-accent-soft/30 rotate-2" />
            <div className="relative overflow-hidden rounded-2xl border border-rule-strong bg-surface-code shadow-2xl shadow-accent/10">
              <div className="flex items-center justify-between border-b border-rule bg-surface-code-bar px-4 py-3">
                <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
                  <span className="size-2 rounded-full bg-fail/70" />
                  <span className="size-2 rounded-full bg-gold/70" />
                  <span className="size-2 rounded-full bg-verify/70" />
                  <span className="ml-2">Submission.lean</span>
                </div>
                <span className="font-mono text-[10px] text-ink-faint">LEAN 4.32.2</span>
              </div>

              <div className="px-5 py-6 font-mono text-[12px] leading-7 sm:text-[13px]">
                <p><span className="text-lean-keyword">import</span> ChallengeDeps</p>
                <p className="mt-3 text-lean-keyword">namespace <span className="text-ink">Submission</span></p>
                <p className="mt-3">
                  <span className="text-lean-keyword">theorem</span>{" "}
                  <span className="text-lean-green">millennium_problem</span> :
                </p>
                <p className="pl-4 text-ink-muted">OpenProblem := <span className="text-lean-keyword">by</span></p>
                <p className="pl-8 text-lean-comment">-- your proof begins here</p>
                <p className="pl-8 text-ink">exact <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">?</span></p>
                <p className="mt-3 text-lean-keyword">end <span className="text-ink">Submission</span></p>
              </div>

              <div className="border-t border-rule bg-card/70 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">
                    {t("verificationPipeline")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-soft px-2 py-1 text-[10px] font-medium text-verify">
                    <CircleDot className="size-3" />
                    {t("readyForProof")}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center font-mono text-[9px] text-ink-muted sm:text-[10px]">
                  <span className="rounded-md border border-rule bg-surface-2 px-2 py-2">SOURCE</span>
                  <ArrowRight className="size-3 text-ink-faint" />
                  <span className="rounded-md border border-rule bg-surface-2 px-2 py-2">SANDBOX</span>
                  <ArrowRight className="size-3 text-ink-faint" />
                  <span className="rounded-md border border-rule bg-surface-2 px-2 py-2">KERNEL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-card px-5 py-4 sm:px-6 sm:py-5">
            <dt className="text-[11px] tracking-[0.1em] text-ink-faint uppercase">
              {cell.label}
            </dt>
            <dd className="mt-1 font-serif text-[28px] leading-none sm:text-[32px]">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      <section id="millennium" className="scroll-mt-24 space-y-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[12px] font-medium tracking-[0.08em] text-gold uppercase">
              <Sparkles className="size-3.5" />
              {t("millenniumEyebrow")}
            </div>
            <h2 className="mt-2 text-[28px] leading-tight sm:text-[36px]">
              {t("millenniumTitle")}
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-ink-muted sm:text-[15px]">
              {t("millenniumBody")}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-rule-strong bg-surface-2 px-3 py-1.5 text-[12px] text-ink-muted">
            <span className="size-2 rounded-full bg-verify" />
            {t("millenniumStatus", { count: millenniumProjects.length })}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {millenniumProjects.map((project, index) => {
            const title = resolveText(project.title, locale as AppLocale).value;
            const summary = resolveText(project.summary, locale as AppLocale).value;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.slug}/problems/${project.slug}`}
                className={`group relative flex min-h-52 flex-col overflow-hidden rounded-2xl border border-rule bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-lg hover:shadow-accent/5 ${
                  index === 0 ? "sm:col-span-2" : ""
                }`}
              >
                <div className="pointer-events-none absolute -right-8 -bottom-12 font-serif text-[120px] leading-none text-accent/[0.035] transition-colors group-hover:text-accent/[0.06]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="relative flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.1em] text-ink-faint">
                    M-{String(index + 1).padStart(2, "0")}
                  </span>
                  <ArrowRight className="size-4 text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </div>
                <div className="relative mt-auto pt-8">
                  <h3 className="text-[19px] leading-snug transition-colors group-hover:text-accent">
                    {title.replace(/^Millennium Prize:\s*/i, "")}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[12.5px] leading-5 text-ink-muted">
                    {summary}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-rule bg-surface-2">
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-rule bg-accent px-6 py-8 text-white sm:px-8 lg:border-r lg:border-b-0 lg:py-10">
            <ShieldCheck className="size-7 text-white/80" />
            <h2 className="mt-5 text-[28px] leading-tight text-white">
              {t("verificationTitle")}
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-white/70">
              {t("verificationBody")}
            </p>
            <a
              href="https://github.com/leanprover/lean-eval"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              {t("learnComparator")}
              <ArrowRight className="size-3.5" />
            </a>
          </div>
          <ol className="grid divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {verificationSteps.map((step) => (
              <li key={step.number} className="bg-card p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <step.icon className="size-5 text-accent" />
                  <span className="font-mono text-[11px] text-ink-faint">{step.number}</span>
                </div>
                <h3 className="mt-8 text-[18px]">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="projects" className="scroll-mt-24 space-y-6">
        <div className="max-w-2xl">
          <div className="text-[12px] font-medium tracking-[0.08em] text-accent uppercase">
            {t("communityEyebrow")}
          </div>
          <h2 className="mt-2 text-[28px] leading-tight sm:text-[34px]">
            {t("communityTitle")}
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-ink-muted">
            {t("communityBody")}
          </p>
        </div>
        <ProjectGrid projects={projects} tags={tags} />
      </section>
    </div>
  );
}
