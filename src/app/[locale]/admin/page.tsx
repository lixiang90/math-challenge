import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getIsAdmin, createServiceClient } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { AppLocale, Profile, Project } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DeleteProjectButton } from "@/components/delete-project-button";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as AppLocale;

  // Force per-request rendering. This gated page must never be statically
  // prerendered — a prerendered redirect would lock out real admins. `connection()`
  // is the canonical Next 15 dynamic signal and is NOT overridden by a parent
  // layout's generateStaticParams (unlike `export const dynamic = "force-dynamic"`,
  // which Next 15.5.22 silently ignores in this nesting).
  await connection();

  // Gate: only site admins may view this page.
  if (!(await getIsAdmin())) redirect(`/${locale}`);

  const supabase = await createClient();
  const [{ data: projects }, { data: profiles }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);
  const profileMap = new Map(
    (profiles ?? []).map((p: Profile) => [p.id, p])
  );

  // Site admins: listed via service role (ordinary users can only see their own row).
  let admins: { login: string; granted_at: string }[] = [];
  const svc = createServiceClient();
  if (svc) {
    const { data } = await svc
      .from("site_admins")
      .select("user_id, granted_at")
      .is("revoked_at", null);
    const ids = (data ?? []).map((a: { user_id: string }) => a.user_id);
    if (ids.length) {
      const { data: ap } = await svc
        .from("profiles")
        .select("id, github_login")
        .in("id", ids);
      const amap = new Map(
        (ap ?? []).map((p: { id: string; github_login: string }) => [
          p.id,
          p.github_login,
        ])
      );
      admins = (data ?? []).map(
        (a: { user_id: string; granted_at: string }) => ({
          login: amap.get(a.user_id) ?? "unknown",
          granted_at: a.granted_at,
        })
      );
    }
  }

  const t = await getTranslations("admin");
  const tn = await getTranslations("nav");

  return (
    <div className="space-y-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" />
        {t("backToSite")}
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-accent" />
          <h1 className="text-[28px] leading-tight">{t("title")}</h1>
        </div>
        <p className="text-[14px] text-ink-muted">{t("subtitle")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-[18px]">{t("adminsHeading")}</h2>
        {admins.length === 0 ? (
          <p className="text-[13px] text-ink-faint">{t("noAdmins")}</p>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-card">
            {admins.map((a) => (
              <li
                key={a.login}
                className="flex items-center justify-between px-5 py-3 text-[13px]"
              >
                <span className="font-mono">@{a.login}</span>
                <span className="text-ink-faint">
                  {t("grantedAt")}: {formatDate(a.granted_at, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-[18px]">{t("projectsHeading")}</h2>
        <div className="overflow-hidden rounded-xl border border-rule bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2 text-ink-faint">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{tn("browse")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("login")}</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">{t("managed")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("edit")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("delete")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {(projects ?? []).map((p: Project) => {
                const owner = profileMap.get(p.owner_id);
                return (
                  <tr key={p.id} className="align-middle">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/projects/${p.slug}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {p.title.en}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink-muted">
                      @{owner?.github_login ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{p.type}</td>
                    <td className="px-4 py-2.5">
                      {p.managed_by_sync ? (
                        <Badge tone="gold">{t("managed")}</Badge>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/projects/${p.slug}/edit`}
                        className="text-accent hover:underline"
                      >
                        {t("edit")}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.managed_by_sync ? (
                        <span className="text-ink-faint">{t("protected")}</span>
                      ) : (
                        <DeleteProjectButton slug={p.slug} locale={locale} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
