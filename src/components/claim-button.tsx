"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { claimProjectAction, type ClaimState } from "@/app/actions/project-actions";

export function ClaimButton({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}) {
  const t = useTranslations("claim");
  const [state, formAction, pending] = useActionState<ClaimState, FormData>(
    claimProjectAction,
    { ok: true }
  );

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rule bg-card px-5 py-3 text-[13px] font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        <ShieldCheck className="size-3.5" />
        {pending ? t("claiming") : t("button")}
      </button>
      {state && !state.ok && state.error && (
        <p className="mt-2 text-[12px] text-red-600">
          {t(`errors.${state.error}`)}
        </p>
      )}
    </form>
  );
}
