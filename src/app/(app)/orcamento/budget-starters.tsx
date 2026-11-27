"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useState, useTransition } from "react";
import { Copy, ListChecks } from "lucide-react";
import { copyPreviousMonth, suggestFromHistory } from "@/server/actions/budgets";
import { Button } from "@/components/ui/button";
import type { MonthRef } from "@/lib/dates";

/** Dois atalhos para não começar o orçamento de uma folha em branco. */
export function BudgetStarters({
  monthRef,
  canCopyPrevious,
  compact = false,
}: {
  monthRef: MonthRef;
  canCopyPrevious: boolean;
  compact?: boolean;
}) {
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<string>) {
    start(async () => {
      setMessage(await action());
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-3"}>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 min-w-11"
          size={compact ? "sm" : "md"}
          variant={compact ? "outline" : "primary"}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const { applied } = await suggestFromHistory(monthRef);
              return applied
                ? translatePlanning(locale, "{0} limite(s) sugerido(s) pela sua média dos últimos 3 meses.", applied)
                : translatePlanning(locale, "Ainda não há histórico suficiente para sugerir limites.");
            })
          }
        >
          <ListChecks className="size-4" aria-hidden="true" />
          {translatePlanning(locale, "Sugerir pelo histórico")} </Button>

        {canCopyPrevious ? (
          <Button className="min-h-11 min-w-11"
            size={compact ? "sm" : "md"}
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const { copied, error } = await copyPreviousMonth(monthRef);
                if (error) return error;
                return copied
                  ? translatePlanning(locale, "{0} limite(s) copiado(s) do mês anterior.", copied)
                  : translatePlanning(locale, "Os limites do mês anterior já estavam aqui.");
              })
            }
          >
            <Copy className="size-4" />
            {translatePlanning(locale, "Copiar do mês anterior")} </Button>
        ) : null}
      </div>

      {message ? (
        <p className="text-[0.8125rem] text-[var(--text-in)]">{message}</p>
      ) : null}
    </div>
  );
}
