import { getTranslations, setRequestLocale } from "next-intl/server";
import { getLeaderboard } from "@/lib/mock/db";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("leaderboard");
  const rows = await getLeaderboard();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[28px] leading-tight">{t("heading")}</h1>
        <p className="text-[15px] text-ink-muted">{t("body")}</p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-rule bg-card">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-rule bg-surface-2 text-left text-[12px] text-ink-muted">
              <th className="w-16 px-4 py-2.5 font-medium">{t("rank")}</th>
              <th className="px-4 py-2.5 font-medium">{t("user")}</th>
              <th className="w-24 px-4 py-2.5 text-right font-medium">
                {t("solved")}
              </th>
              <th className="w-28 px-4 py-2.5 text-right font-medium">
                {t("points")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-[14px] text-ink-muted"
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.profile.id}
                  className="border-b border-rule last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-[13px] text-ink-faint">
                    {row.rank}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-medium text-accent">
                        {row.profile.display_name.slice(0, 2).toUpperCase()}
                      </span>
                      <span>
                        <span className="block leading-tight text-ink">
                          {row.profile.display_name}
                        </span>
                        <span className="block font-mono text-[12px] text-ink-faint">
                          @{row.profile.github_login}
                        </span>
                      </span>
                      {user && row.profile.id === user.id && (
                        <Badge tone="accent">{t("you")}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-ink-muted">
                    {row.solved_count}
                  </td>
                  <td className="px-4 py-3 text-right font-serif text-[17px]">
                    {row.points}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
