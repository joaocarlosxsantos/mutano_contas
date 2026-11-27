import { Card, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import type { DailyBudgetResult } from "@/lib/daily-budget";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

export function DailyBudgetCard({
  dailyBudget,
  spentTodayCents,
  historyDays,
  className,
  locale = "pt-BR",
}: {
  dailyBudget: DailyBudgetResult;
  spentTodayCents: number;
  historyDays: number;
  className?: string;
  locale?: Locale;
}) {
  const dict = getActivityDict(locale);

  return (
    <Card className={`min-w-0 ${className ?? ""}`}>
      <CardHeader
        title={dict["Quanto posso gastar hoje?"]}
        subtitle={dict["Cota estimada para gastos variáveis, ponderada pelo dia da semana e pela renda prevista, após reservar compromissos do mês."]}
      />
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="muted text-xs">{dict["Cota segura de hoje"]}</dt>
          <dd className="mt-1"><Money cents={dailyBudget.dailyAllowanceCents} size="md" /></dd>
        </div>
        <div className="min-w-0">
          <dt className="muted text-xs">{dict["Já gasto hoje"]}</dt>
          <dd className="mt-1"><Money cents={spentTodayCents} size="md" /></dd>
        </div>
        <div className="min-w-0">
          <dt className="muted text-xs">{dict["Restante hoje"]}</dt>
          <dd className="mt-1"><Money cents={dailyBudget.remainingTodayCents} size="md" tone={dailyBudget.status === "exceeded" ? "out" : undefined} /></dd>
        </div>
      </dl>
      {dailyBudget.remainingTodayCents === 0 && <p className="mt-3 text-xs text-[var(--text-out)]">{dict["Sem margem para novos gastos variáveis hoje."]}</p>}
      {historyDays < 14 && <p className="muted mt-3 text-xs">{dict["Histórico curto (menos de 14 dias). Use esta estimativa com cuidado."]}</p>}
    </Card>
  );
}
