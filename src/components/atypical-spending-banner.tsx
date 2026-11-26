"use client";

import { useLocale } from "@/lib/i18n/context";
import { getComponentsTranslator } from "@/lib/i18n/dictionaries/components";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

export type AtypicalSpending = {
  id: string | null; name: string; day: string; todayCents: number;
  historyCents: number; transactionId: string | null;
};
const eventName = "atypical-spending-dismissed";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(eventName, listener);
  };
}

function SpendingNotice({ item, userId }: { item: AtypicalSpending; userId: string }) {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  const key = `atypical:${userId}:${item.day}:${item.id ?? "none"}`;
  const dismissed = useSyncExternalStore(subscribe, () => {
    try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
  }, () => false);
  // Keep dismissal functional when browser storage is unavailable as well.
  const locallyDismissed = useSyncExternalStore(subscribe, () => dismissedKeys.has(key), () => false);
  if (dismissed || locallyDismissed) return null;
  const params = new URLSearchParams({ from: item.day, to: item.day, kind: "EXPENSE", cat: item.id ?? "NONE" });
  return (
    <aside tabIndex={-1} aria-label={t("Gasto acima do usual em {name}", { name: item.name })} className="card mb-4 flex min-w-0 items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">{t("Gasto acima do usual em")} {item.name}</h2>
        <p className="muted mt-1 text-xs leading-relaxed">
          {t("Hoje:")} {formatCents(item.todayCents, locale)}{t(". Média diária nos 30 dias anteriores:")} {formatCents(Math.round(item.historyCents / 30), locale)}.
        </p>
        <Link className="mt-1 inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={`/lancamentos?${params}#transaction-${item.transactionId}`}>
          {t("Ver lançamento")}</Link>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label={t("Dispensar aviso de {name} hoje", { name: item.name })} onClick={(event) => {
        const notice = event.currentTarget.closest("aside");
        if (notice?.contains(document.activeElement)) {
          const nextNotice = notice.nextElementSibling as HTMLElement | null;
          (nextNotice ?? notice.parentElement)?.focus();
        }
        dismissedKeys.add(key);
        try { sessionStorage.setItem(key, "1"); } catch { /* Storage may be disabled. */ }
        window.dispatchEvent(new Event(eventName));
      }}><X aria-hidden="true" className="size-4" /></Button>
    </aside>
  );
}
const dismissedKeys = new Set<string>();

export function AtypicalSpendingBanner({ items, userId }: { items: AtypicalSpending[]; userId: string }) {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  if (!items.length) return null;
  return (
    <div role="region" aria-label={t("Avisos de gastos atípicos")} tabIndex={-1}>
      {items.map(item => <SpendingNotice key={`${item.day}:${item.id}`} item={item} userId={userId} />)}
    </div>
  );
}
