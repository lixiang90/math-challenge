"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import {
  deleteProjectAction,
  type DeleteState,
} from "@/app/actions/project-actions";

export function DeleteProjectButton({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}) {
  const t = useTranslations("project");
  const [state, formAction, pending] = useActionState<DeleteState, FormData>(
    deleteProjectAction,
    { ok: true }
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm(t("deleteConfirm"))) e.preventDefault();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-card px-5 py-3 text-[13px] font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="size-3.5" />
        {pending ? t("deleting") : t("delete")}
      </button>
      {state && !state.ok && state.error && (
        <p className="mt-2 text-[12px] text-red-600">
          {t(`errors.${state.error}`)}
        </p>
      )}
    </form>
  );
}
