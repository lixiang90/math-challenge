"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Light/dark toggle. The actual theme is driven by a `dark` class on <html>,
 * set by the no-flash inline script in the root layout and toggled here.
 * The icon swaps purely via the `dark:` variant, so there is no hydration
 * mismatch.
 */
export function ThemeToggle() {
  const t = useTranslations("theme");

  function toggle() {
    const root = document.documentElement;
    const isDark = root.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggle")}
      title={t("toggle")}
      className="inline-flex size-9 items-center justify-center rounded-md border border-rule bg-card text-ink-muted transition-colors hover:bg-surface-4 hover:text-ink"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="block size-4 dark:hidden" />
    </button>
  );
}
