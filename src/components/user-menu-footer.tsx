"use client";

import { useTranslation } from "@/lib/i18n/use-translation";


import { LanguageToggle } from "./language-toggle";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { isDestinationActive } from "./navigation-model";

export function UserMenuFooter({ userName, pathname, onNavigate }: { userName: string; pathname: string; onNavigate?: () => void }) {
  const t = useTranslation();

  return <div className="mt-5 shrink-0 border-t border-[var(--line)] pt-3 pb-4">
    <Link href="/usuario" replace={Boolean(onNavigate)} onClick={onNavigate} aria-label={`${t("Minha conta")} — ${userName}`} aria-current={isDestinationActive(pathname, "/usuario") ? "page" : undefined}
      className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--surface-2)] aria-[current=page]:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)]"><UserRound aria-hidden="true" className="size-5" strokeWidth={1.5} /></span>
      <span className="min-w-0"><span className="block truncate text-sm font-medium">{userName}</span><span className="block text-xs text-[var(--text-muted)]">{t("Minha conta")}</span></span>
    </Link>
    <div className="mt-3 px-3"><LanguageToggle /></div>
    <LogoutButton />
  </div>;
}
