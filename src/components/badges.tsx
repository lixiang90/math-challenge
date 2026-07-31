"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type {
  Difficulty,
  ProjectType,
  SubmissionStatus,
} from "@/lib/types";

const DIFFICULTY_TONE = {
  intro: "neutral",
  easy: "verify",
  medium: "accent",
  hard: "pending",
  research: "fail",
} as const;

const STATUS_TONE = {
  queued: "neutral",
  running: "accent",
  passed: "verify",
  failed: "fail",
  error: "fail",
  timeout: "pending",
  review: "gold",
} as const;

export function TypeBadge({ type }: { type: ProjectType }) {
  const t = useTranslations("projectType");
  return (
    <Badge tone={type === "challenge" ? "gold" : "outline"}>{t(type)}</Badge>
  );
}

export function DifficultyBadge({ level }: { level: Difficulty }) {
  const t = useTranslations("difficulty");
  return <Badge tone={DIFFICULTY_TONE[level]}>{t(level)}</Badge>;
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const t = useTranslations("status");
  return (
    <Badge tone={STATUS_TONE[status]}>
      {status === "running" && (
        <span
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {t(status)}
    </Badge>
  );
}

export function FallbackNotice() {
  const t = useTranslations("common");
  return (
    <p className="mb-2 rounded-md border border-rule bg-surface-2 px-3 py-1.5 text-[12px] text-ink-faint">
      {t("noTranslation")}
    </p>
  );
}
