import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectForm } from "@/components/project-form";
import { createClient } from "@/lib/supabase/server";
import { getProjectBySlug } from "@/lib/mock/db";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projectForm");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/me`);

  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  if (project.owner_id !== user.id) redirect(`/${locale}/projects/${slug}`);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-[28px] leading-tight">{t("editTitle")}</h1>
        <p className="text-[14px] text-ink-muted">{t("editSubtitle")}</p>
      </header>
      <ProjectForm locale={locale} mode="edit" slug={slug} project={project} />
    </div>
  );
}
