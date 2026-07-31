import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-rule-strong bg-card px-3 text-sm text-ink placeholder:text-ink-faint",
      "focus:border-accent focus:outline-none focus-visible:outline-none",
      "aria-[invalid=true]:border-fail",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full appearance-none rounded-md border border-rule-strong bg-card px-3 pr-8 text-sm text-ink",
      "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M3 4.5L6 8L9 4.5%22 fill=%22none%22 stroke=%22%236b6862%22 stroke-width=%221.4%22 stroke-linecap=%22round%22/></svg>')] bg-[length:12px] bg-[right_0.6rem_center] bg-no-repeat",
      "focus:border-accent focus:outline-none",
      className
    )}
    {...props}
  />
));
Select.displayName = "Select";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-[13px] font-medium text-ink", className)}
      {...props}
    />
  );
}

export function FieldHint({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[12px] text-ink-faint", className)} {...props} />
  );
}

export function FieldError({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      role="alert"
      className={cn("text-[12px] text-fail", className)}
      {...props}
    />
  );
}
