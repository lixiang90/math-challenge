"use client";

import { useTranslations } from "next-intl";
import { Sigma } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", key: "browse" as const, match: (p: string) => p === "/" || p.startsWith("/projects") },
  { href: "/goldbach", key: "goldbach" as const, match: (p: string) => p.startsWith("/goldbach") },
  { href: "/leaderboard", key: "leaderboard" as const, match: (p: string) => p.startsWith("/leaderboard") },
];

export function SiteHeader() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="mr-2 flex items-center gap-2 text-ink transition-opacity hover:opacity-70"
        >
          <Sigma className="size-5 text-accent" />
          <span className="font-serif text-[17px] tracking-tight">
            {tc("appName")}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                item.match(pathname)
                  ? "bg-surface-4 text-ink"
                  : "text-ink-muted hover:bg-surface-4 hover:text-ink"
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <LocaleSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
