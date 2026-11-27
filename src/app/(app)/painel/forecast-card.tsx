import { Card, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { formatCents } from "@/lib/money";
import type { DashboardForecast } from "@/lib/dashboard-forecast";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

interface ForecastCardProps {
  forecast: DashboardForecast;
  monthName: string;
  className?: string;
  locale?: Locale;
}

export function ForecastCard({ forecast, monthName, className, locale = "pt-BR" }: ForecastCardProps) {
  const dict = getActivityDict(locale);
  const past = forecast.period === "past";
  const current = forecast.period === "current";
  const title = past ? dict["Fechamento do mês"] : current ? dict["Previsão de fim do mês"] : dict["Planejamento do mês"];
  const isNegative = forecast.projectedBalanceCents < 0;
  const cells = past ? [
    { label: dict["Receita realizada"], cents: forecast.realizedIncomeCents },
    { label: dict["Despesa realizada"], cents: forecast.realizedExpenseCents },
  ] : current ? [
    { label: dict["Saldo realizado no mês"], cents: forecast.realizedBalanceCents },
  ] : [
    { label: dict["A receber"], cents: forecast.receivableCents },
    { label: dict["A pagar"], cents: forecast.payableCents },
  ];

  return (
    <Card className={`min-w-0 ${className ?? ""}`}>
      <CardHeader title={title} subtitle={past
        ? `${dict["Entradas e saídas realizadas em "]}${monthName}.`
        : current ? `${dict["Resultado de caixa estimado para "]}${monthName}.`
        : `${dict["Entradas e saídas previstas para "]}${monthName}${dict[", sem estimativa por média."]}`} />

      {!forecast.hasData ? (
        <p className="text-sm text-[var(--text-muted)]">
          {past ? dict["Sem movimentações realizadas neste mês. Nenhum resultado estimado."] : dict["Sem movimentações ou recorrências previstas neste mês. Nenhum resultado estimado."]}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {cells.map(cell => <div key={cell.label} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">{cell.label}</p>
              <div className="mt-1.5"><Money cents={cell.cents} size="md" className="text-base font-semibold" /></div>
            </div>)}
            {current && <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">{dict["A receber / a pagar"]}</p>
              <div className="mt-1.5 space-y-1 text-sm">
                <p>+ {formatCents(forecast.receivableCents, locale)}</p>
                <p>− {formatCents(forecast.payableCents, locale)}</p>
              </div>
            </div>}
            <div className={`min-w-0 rounded-xl border p-3 ${isNegative
              ? "border-[var(--color-money-out)]/30 bg-[var(--color-money-out)]/5"
              : "border-[var(--border)] bg-[var(--surface)]"}`}>
              <p className="text-xs font-medium text-[var(--text-muted)]">{past ? dict["Resultado realizado"] : current ? dict["Resultado estimado"] : dict["Resultado previsto"]}</p>
              <div className="mt-1.5"><Money cents={forecast.projectedBalanceCents} tone={isNegative ? "out" : undefined} size="md" className="text-base font-semibold" /></div>
            </div>
          </div>
          {current && <p className="mt-3 text-xs text-[var(--text-muted)]">
            {forecast.daysRemaining} {forecast.daysRemaining === 1 ? dict["dia restante"] : dict["dias restantes"]} · {dict["Ritmo variável:"]} {formatCents(forecast.dailyAvgCents, locale)}{dict["/dia."]}
            {" "}{dict["Gastos adicionais estimados:"]} {formatCents(forecast.additionalExpenseCents, locale)}.
          </p>}
          {!past && <p className="mt-2 text-xs text-[var(--text-muted)]">
            {dict["A receber considera a renda mensal cadastrada ainda não recebida e as entradas previstas, sem duplicar valores. Resultado do mês, sem saldo inicial das contas."]}
          </p>}
        </>
      )}
    </Card>
  );
}
