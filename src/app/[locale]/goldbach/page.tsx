import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  Github,
  History,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RichText } from "@/components/markdown";

const GOLDBACH_PROJECT = "/projects/goldbach_conjecture/problems/goldbach_conjecture";
const GOLDBACH_REPO =
  "https://github.com/lixiang90/math-challenge-millennium/tree/main/generated/goldbach_conjecture";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "goldbach" });
  return {
    title: t("heroTitle"),
    description: t("heroBody"),
  };
}

function Eyebrow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium tracking-[0.08em] text-gold uppercase">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

function GoldbachStatementCard({ caption }: { caption: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-rule-strong bg-surface-code shadow-2xl shadow-accent/10">
      <div className="flex items-center justify-between border-b border-rule bg-surface-code-bar px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
          <span className="size-2 rounded-full bg-fail/70" />
          <span className="size-2 rounded-full bg-gold/70" />
          <span className="size-2 rounded-full bg-verify/70" />
          <span className="ml-2">Goldbach.lean</span>
        </div>
        <span className="font-mono text-[10px] text-ink-faint">LEAN 4.32.2</span>
      </div>
      <div className="px-5 py-6 font-mono text-[12px] leading-7 sm:text-[13px]">
        <p>
          <span className="text-lean-keyword">import</span> Mathlib
        </p>
        <p className="mt-3 text-lean-keyword">namespace <span className="text-ink">Goldbach</span></p>
        <p className="mt-3 text-lean-comment">/-- Every even integer n ≥ 4 is the sum of two primes. -/</p>
        <p className="mt-2">
          <span className="text-lean-keyword">def</span>{" "}
          <span className="text-lean-green">GoldbachConjecture</span> : <span className="text-ink">Prop</span> :=
        </p>
        <p className="pl-4">
          <span className="text-ink">∀</span> n : <span className="text-ink">ℕ</span>, 4 ≤ n → n % 2 = 0 →
        </p>
        <p className="pl-8">
          <span className="text-ink">∃</span> p q : <span className="text-ink">ℕ</span>,{" "}
          <span className="text-lean-gold">Nat.Prime</span> p ∧{" "}
          <span className="text-lean-gold">Nat.Prime</span> q ∧ p + q = n
        </p>
        <p className="mt-3 text-lean-comment">-- Challenge.lean</p>
        <p className="mt-1">
          <span className="text-lean-keyword">theorem</span>{" "}
          <span className="text-lean-green">goldbach_conjecture</span> :{" "}
          <span className="text-ink">GoldbachConjecture</span> := <span className="text-lean-keyword">by</span>
        </p>
        <p className="pl-4 text-ink">sorry</p>
      </div>
      <div className="border-t border-rule bg-card/70 px-4 py-3 text-[11px] text-ink-muted">
        {caption}
      </div>
    </div>
  );
}

function PipelineRow({ label }: { label: string }) {
  const nodes = [
    { key: "SOURCE", icon: Sigma },
    { key: "SANDBOX", icon: ShieldCheck },
    { key: "KERNEL", icon: Cpu },
  ];
  return (
    <div className="rounded-2xl border border-rule bg-surface-2 p-5">
      <div className="mb-4 text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center font-mono text-[10px] text-ink-muted sm:text-[11px]">
        {nodes.map((node, i) => (
          <div key={node.key} className="contents">
            <span className="flex flex-col items-center gap-2 rounded-lg border border-rule bg-card px-2 py-3">
              <node.icon className="size-4 text-accent" />
              {node.key}
            </span>
            {i < nodes.length - 1 && <ArrowRight className="size-3 text-ink-faint" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function GoldbachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("goldbach");

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-rule bg-card px-5 py-7 shadow-[0_24px_80px_-48px_rgba(31,58,110,0.45)] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-gold-soft/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-accent-soft/70 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold-soft px-3 py-1 text-[12px] font-medium tracking-[0.08em] text-gold uppercase">
              <Sigma className="size-3.5" />
              {t("heroEyebrow")}
            </div>
            <h1 className="mt-6 text-[36px] leading-[1.06] tracking-[-0.03em] sm:text-[50px] lg:text-[58px]">
              {t("heroTitle")}
              <span className="mt-1 block text-accent">{t("heroAccent")}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ink-muted sm:text-[17px]">
              {t("heroBody")}
            </p>

            <div className="mt-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rule-strong bg-surface-2 px-3 py-1 text-[12px] text-ink-muted">
                <span className="size-2 rounded-full bg-gold" />
                {t("notMillennium")}
              </span>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={GOLDBACH_PROJECT}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {t("heroCtaPrimary")}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href={GOLDBACH_REPO}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rule-strong bg-card/80 px-5 text-[14px] font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
              >
                <Github className="size-4" />
                {t("heroCtaSecondary")}
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[440px] lg:mx-0 lg:ml-auto">
            <div className="absolute -inset-3 rotate-2 rounded-[26px] border border-accent/10 bg-accent-soft/30" />
            <div className="relative">
              <GoldbachStatementCard caption={t("statementCardCaption")} />
            </div>
          </div>
        </div>
      </section>

      {/* Statement */}
      <section className="space-y-6">
        <div className="max-w-3xl">
          <Eyebrow icon={Sigma}>{t("statementEyebrow")}</Eyebrow>
          <h2 className="mt-2 text-[28px] leading-tight sm:text-[36px]">
            {t("statementTitle")}
          </h2>
        </div>
        <div className="max-w-3xl">
          <RichText>{t("statementBody")}</RichText>
        </div>
      </section>

      {/* History */}
      <section className="space-y-6 border-t border-rule pt-14 sm:pt-16">
        <div className="max-w-3xl">
          <Eyebrow icon={History}>{t("historyEyebrow")}</Eyebrow>
          <h2 className="mt-2 text-[28px] leading-tight sm:text-[36px]">
            {t("historyTitle")}
          </h2>
        </div>
        <div className="max-w-3xl">
          <RichText>{t("historyBody")}</RichText>
        </div>
      </section>

      {/* China */}
      <section className="space-y-6 border-t border-rule pt-14 sm:pt-16">
        <div className="max-w-3xl">
          <Eyebrow icon={BookOpen}>{t("chinaEyebrow")}</Eyebrow>
          <h2 className="mt-2 text-[28px] leading-tight sm:text-[36px]">
            {t("chinaTitle")}
          </h2>
        </div>
        <div className="max-w-3xl">
          <RichText>{t("chinaBody")}</RichText>
        </div>
      </section>

      {/* The amateur's dilemma */}
      <section className="border-t border-rule pt-14 sm:pt-16">
        <div className="overflow-hidden rounded-2xl border border-rule bg-surface-2">
          <div className="grid lg:grid-cols-[0.7fr_1.3fr]">
            <div className="border-b border-rule bg-gold px-6 py-8 text-ink sm:px-8 lg:border-b-0 lg:border-r lg:py-10">
              <Scale className="size-7 text-ink/80" />
              <h2 className="mt-5 text-[26px] leading-tight text-ink">
                {t("gapTitle")}
              </h2>
              <p className="mt-3 text-[13px] leading-6 text-ink/70">
                {t("gapEyebrow")}
              </p>
            </div>
            <div className="bg-card p-6 sm:p-8">
              <RichText>{t("gapBody")}</RichText>
            </div>
          </div>
        </div>
      </section>

      {/* How the comparator helps */}
      <section className="space-y-8 border-t border-rule pt-14 sm:pt-16">
        <div className="max-w-3xl">
          <Eyebrow icon={ShieldCheck}>{t("howEyebrow")}</Eyebrow>
          <h2 className="mt-2 text-[28px] leading-tight sm:text-[36px]">
            {t("howTitle")}
          </h2>
        </div>
        <div className="max-w-3xl">
          <RichText>{t("howBody")}</RichText>
        </div>
        <PipelineRow label={t("howEyebrow")} />
      </section>

      {/* Final CTA */}
      <section className="overflow-hidden rounded-2xl border border-rule bg-accent px-6 py-9 text-white sm:px-10 sm:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[26px] leading-tight text-white sm:text-[34px]">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-6 text-white/75 sm:text-[15px]">
            {t("ctaBody")}
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={GOLDBACH_PROJECT}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[14px] font-medium text-accent transition-opacity hover:opacity-90"
            >
              {t("ctaPrimary")}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/projects"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/30 px-5 text-[14px] font-medium text-white transition-colors hover:border-white/60"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
