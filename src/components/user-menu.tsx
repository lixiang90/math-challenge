"use client";

import { useTranslations } from "next-intl";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Github, LogOut, Plus, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? "") + (parts[1][0] ?? "");
}

export function UserMenu() {
  const t = useTranslations("nav");
  const { user, isLoading, signIn, signOut } = useSession();

  if (isLoading) {
    return (
      <div
        className="size-8 animate-pulse rounded-full bg-accent-soft"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Button size="sm" onClick={() => void signIn()}>
        <Github className="size-4" />
        <span className="hidden sm:inline">{t("signIn")}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("profile")}
        className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-rule-strong bg-accent-soft text-[12px] font-medium text-accent transition-colors hover:border-accent"
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt={user.display_name}
            className="size-full object-cover"
          />
        ) : (
          initials(user.display_name).toUpperCase()
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-lg border border-rule bg-card p-1 shadow-[0_6px_24px_rgba(27,26,23,0.08)]"
        >
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-medium text-ink">
              {user.display_name}
            </p>
            <p className="text-[12px] text-ink-faint">@{user.github_login}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-rule" />
          <DropdownMenu.Item asChild>
            <Link
              href="/me"
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-accent-soft"
            >
              <User className="size-3.5" />
              {t("profile")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              href="/projects/new"
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-accent-soft"
            >
              <Plus className="size-3.5" />
              {t("newProject")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-rule" />
          <DropdownMenu.Item
            onSelect={() => void signOut()}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-accent-soft"
          >
            <LogOut className="size-3.5" />
            {t("signOut")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
