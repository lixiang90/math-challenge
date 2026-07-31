import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProjectForm } from "@/components/project-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projectForm");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/me`);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-[28px] leading-tight">{t("newTitle")}</h1>
        <p className="text-[14px] text-ink-muted">{t("newSubtitle")}</p>
      </header>
      <ProjectForm locale={locale} mode="create" />
    </div>
  );
}
