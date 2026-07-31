"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Check, Globe } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("language")}
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink-muted transition-colors",
          "hover:bg-surface-4 hover:text-ink disabled:opacity-50"
        )}
      >
        <Globe className="size-4" />
        <span className="hidden sm:inline">{localeLabels[locale]}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[160px] rounded-lg border border-rule bg-card p-1 shadow-[0_6px_24px_rgba(27,26,23,0.08)]"
        >
          {routing.locales.map((l) => (
            <DropdownMenu.Item
              key={l}
              onSelect={() => switchTo(l)}
              className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-accent-soft"
            >
              {localeLabels[l]}
              {l === locale && <Check className="size-3.5 text-accent" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
