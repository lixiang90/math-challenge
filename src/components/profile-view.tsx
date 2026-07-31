"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useLocale, useTranslations } from "next-intl";
import { Github } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/session-provider";
import { DifficultyBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { resolveText } from "@/lib/i18n-content";
import { formatDate, formatDateTime, shortSha } from "@/lib/utils";
import type {
  AppLocale,
  PointsLedgerEntry,
  ProjectListItem,
  SubmissionWithContext,
} from "@/lib/types";

interface Stats {
  points: number;
  solved_count: number;
  submission_count: number;
  project_count: number;
}

export function ProfileView({
  stats,
  submissions,
  projects,
  ledger,
}: {
  stats: Stats;
  submissions: SubmissionWithContext[];
  projects: ProjectListItem[];
  ledger: PointsLedgerEntry[];
}) {
  const t = useTranslations("profile");
  const ts = useTranslations("submission");
  const ta = useTranslations("auth");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const loc = locale as AppLocale;
  const { user, signIn } = useSession();

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-rule bg-card px-6 py-10 text-center">
        <h1 className="font-serif text-[20px]">{ta("demoTitle")}</h1>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {ta("demoBody")}
        </p>
        <Button onClick={signIn}>
          <Github className="size-4" />
          {tn("signIn")}
        </Button>
      </div>
    );
  }

  const cells = [
    { value: stats.points, label: t("points") },
    { value: stats.solved_count, label: t("solved") },
    { value: stats.submission_count, label: t("submissions") },
    { value: stats.project_count, label: t("projects") },
  ];

  const tabClass =
    "border-b-2 border-transparent px-3 py-2 text-[13.5px] text-ink-muted transition-colors data-[state=active]:border-accent data-[state=active]:text-ink";

  return (
    <div className="space-y-7">
      <header className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft font-serif text-[19px] text-accent">
          {user.display_name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-[24px] leading-tight">{user.display_name}</h1>
          <p className="font-mono text-[13px] text-ink-faint">
            @{user.github_login}
          </p>
        </div>
      </header>

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

      <Tabs.Root defaultValue="submissions">
        <Tabs.List className="flex gap-1 border-b border-rule">
          <Tabs.Trigger value="submissions" className={tabClass}>
            {t("tabSubmissions")}
          </Tabs.Trigger>
          <Tabs.Trigger value="projects" className={tabClass}>
            {t("tabProjects")}
          </Tabs.Trigger>
          <Tabs.Trigger value="points" className={tabClass}>
            {t("tabPoints")}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="submissions" className="pt-4">
          {submissions.length === 0 ? (
            <Empty>{t("noSubmissions")}</Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-rule bg-card">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-rule bg-surface-2 text-left text-[12px] text-ink-muted">
                    <th className="px-4 py-2 font-medium">
                      {ts("colSubmitted")}
                    </th>
                    <th className="px-4 py-2 font-medium">Problem</th>
                    <th className="px-4 py-2 font-medium">{ts("colCommit")}</th>
                    <th className="px-4 py-2 font-medium">{ts("colStatus")}</th>
                    <th className="px-4 py-2 text-right font-medium">
                      {ts("colPoints")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-rule last:border-b-0"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">
                        {formatDateTime(s.created_at, locale)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/projects/${s.project.slug}/problems/${s.problem.slug}`}
                          className="text-accent hover:underline"
                        >
                          {resolveText(s.problem.title, loc).value}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px]">
                        {shortSha(s.commit_sha)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {s.points_awarded > 0 ? `+${s.points_awarded}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="projects" className="pt-4">
          {projects.length === 0 ? (
            <Empty>{t("noProjects")}</Empty>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-card">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.slug}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">
                        {resolveText(p.title, loc).value}
                      </span>
                      <span className="block text-[12px] text-ink-faint">
                        {formatDate(p.updated_at, locale)}
                      </span>
                    </span>
                    <TypeBadge type={p.type} />
                    <DifficultyBadge level={p.difficulty} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tabs.Content>

        <Tabs.Content value="points" className="pt-4">
          {ledger.length === 0 ? (
            <Empty>{t("noSubmissions")}</Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-rule bg-card">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-rule bg-surface-2 text-left text-[12px] text-ink-muted">
                    <th className="px-4 py-2 font-medium">{t("ledgerDate")}</th>
                    <th className="px-4 py-2 font-medium">
                      {t("ledgerReason")}
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      {t("ledgerDelta")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-rule last:border-b-0"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">
                        {formatDate(e.created_at, locale)}
                      </td>
                      <td className="px-4 py-2.5 text-ink">
                        {t(e.reason_key, e.reason_params)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-verify">
                        +{e.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-rule-strong px-5 py-10 text-center text-[13px] text-ink-faint">
      {children}
    </p>
  );
}
