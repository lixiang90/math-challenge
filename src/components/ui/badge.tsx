import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] leading-5 font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-rule-strong bg-surface-2 text-ink-muted",
        accent: "border-accent/25 bg-accent-soft text-accent",
        gold: "border-gold/25 bg-gold-soft text-gold",
        verify: "border-verify/25 bg-verify-soft text-verify",
        fail: "border-fail/25 bg-fail-soft text-fail",
        pending: "border-pending/25 bg-pending-soft text-pending",
        outline: "border-rule-strong bg-transparent text-ink-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
