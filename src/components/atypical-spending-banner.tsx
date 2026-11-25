"use client";

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
  const key = `atypical:${userId}:${item.day}:${item.id ?? "none"}`;
  const dismissed = useSyncExternalStore(subscribe, () => {
    try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
  }, () => false);
  // Keep dismissal functional when browser storage is unavailable as well.
  const locallyDismissed = useSyncExternalStore(subscribe, () => dismissedKeys.has(key), () => false);
  if (dismissed || locallyDismissed) return null;
  const params = new URLSearchParams({ from: item.day, to: item.day, kind: "EXPENSE", cat: item.id ?? "NONE" });
  return (
    <aside tabIndex={-1} aria-label={`Gasto acima do usual em ${item.name}`} className="card mb-4 flex min-w-0 items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">Gasto acima do usual em {item.name}</h2>
        <p className="muted mt-1 text-xs leading-relaxed">
          Hoje: {formatCents(item.todayCents)}. Média diária nos 30 dias anteriores: {formatCents(Math.round(item.historyCents / 30))}.
        </p>
        <Link className="mt-1 inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={`/lancamentos?${params}#transaction-${item.transactionId}`}>
          Ver lançamento
        </Link>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label={`Dispensar aviso de ${item.name} hoje`} onClick={(event) => {
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
  if (!items.length) return null;
  return (
    <div role="region" aria-label="Avisos de gastos atípicos" tabIndex={-1}>
      {items.map(item => <SpendingNotice key={`${item.day}:${item.id}`} item={item} userId={userId} />)}
    </div>
  );
}
