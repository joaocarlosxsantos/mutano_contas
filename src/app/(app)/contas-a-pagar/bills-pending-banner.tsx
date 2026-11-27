"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { generateBillsForMonth } from "@/server/actions/bills";
import { Button } from "@/components/ui/button";
import { monthRefToParam, type MonthRef } from "@/lib/dates";

export type PendingRule = { id: string; name: string };

/**
 * Aviso de contas recorrentes que ainda não têm registro neste mês. Um clique
 * cria a linha do mês para cada uma (valor começa em zero — o valor de cada
 * mês é preenchido depois, na própria conta). Nada é criado sem o usuário mandar.
 */
export function BillsPendingBanner({
  monthRef,
  monthName,
  pending,
}: {
  monthRef: MonthRef;
  monthName: string;
  pending: PendingRule[];
}) {
  const locale = useLocale();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!pending.length) return null;

  return (
    <div className="card mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-[var(--border)] p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-save-soft)] text-[var(--text-brand)]">
        <CalendarClock className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium">
          {translatePlanning(locale, pending.length === 1 ? "{0} conta recorrente ainda sem registro em {1}." : "{0} contas recorrentes ainda sem registro em {1}.", pending.length, monthName)}
        </p>
        <p className="muted mt-0.5 truncate text-[0.8125rem]">
          {pending.map((r) => r.name).join(", ")}
          {message ? ` — ${message}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button className="min-h-11 min-w-11"
          size="sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const { created, error } = await generateBillsForMonth(monthRefToParam(monthRef));
              setMessage(error ?? translatePlanning(locale, "{0} conta(s) criada(s) — falta preencher o valor.", created));
            })
          }
        >
          {busy ? translatePlanning(locale, "Criando...") : translatePlanning(locale, "Criar deste mês")}
        </Button>
      </div>
    </div>
  );
}
