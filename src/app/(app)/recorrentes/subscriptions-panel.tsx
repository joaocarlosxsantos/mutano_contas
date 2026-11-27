import { TrendingUp, AlertTriangle, Sparkles, CheckCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import type { DetectedSubscription } from "@/lib/subscriptions";
import { annualSubscriptionCents } from "@/lib/insight-metrics";
import { formatCents } from "@/lib/money";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

interface SubscriptionsPanelProps {
  subscriptions: DetectedSubscription[];
  locale?: Locale;
}

export function SubscriptionsPanel({ subscriptions, locale = "pt-BR" }: SubscriptionsPanelProps) {
  if (!subscriptions.length) return null;
  const dict = getActivityDict(locale);

  const unregisteredCount = subscriptions.filter((s) => !s.isRegistered).length;
  const priceIncreaseCount = subscriptions.filter((s) => s.hasPriceIncrease).length;

  return (
    <Card className="min-w-0" aria-label={dict["Assinaturas e recorrências detectadas"]}>
      <CardHeader
        title={dict["Assinaturas detectadas nos lançamentos"]}
        subtitle={dict["Identificamos cobranças mensais frequentes nos seus lançamentos recentes."]}
      />

      {(priceIncreaseCount > 0 || unregisteredCount > 0) && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {priceIncreaseCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              {priceIncreaseCount} {priceIncreaseCount === 1 ? dict[" aumento de preço detectado"] : dict[" aumentos de preço detectados"]}
            </span>
          )}
          {unregisteredCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-muted)]">
              <Sparkles className="h-3.5 w-3.5" />
              {unregisteredCount} {unregisteredCount === 1 ? dict[" assinatura não cadastrada em regras"] : dict[" assinaturas não cadastradas em regras"]}
            </span>
          )}
        </div>
      )}

      <div className="divide-y divide-[var(--line)]">
        {subscriptions.map((sub) => (
          <div key={sub.normalizedName} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-[var(--text)]">
                  {sub.name}
                </p>
                {sub.hasPriceIncrease && (
                  <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--color-money-out)]/30 bg-[var(--color-money-out)]/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--color-money-out)]">
                    <TrendingUp className="h-3 w-3" />
                    +{sub.priceIncreasePct}% · +{formatCents(annualSubscriptionCents(sub.priceIncreaseCents ?? 0, sub.cadence), locale)}{dict["/ano"]}
                  </span>
                )}
                {!sub.isRegistered ? (
                  <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[0.6875rem] text-[var(--text-muted)]">
                    {dict["Não cadastrado"]}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[0.6875rem] text-[var(--text-muted)]">
                    <CheckCircle className="h-3 w-3 text-[var(--color-money-in)]" />
                    {dict["Regra ativa"]}
                  </span>
                )}
              </div>

              {sub.categoryName && (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {sub.categoryName} • {dict[" • Cobrança em "]}{sub.monthOccurrences}{dict[" meses"]}
                </p>
              )}
            </div>

            <div className="flex items-baseline justify-between sm:flex-col sm:items-end">
              <span className="muted text-xs">{sub.cadence === "annual" ? dict["Por ano"] : dict["Por mês"]}</span>
              <Money
                cents={sub.currentAmountCents}
                tone="out"
                size="md"
                className="text-sm font-semibold"
              />
              {sub.hasPriceIncrease && sub.previousAmountCents && (
                <span className="text-[0.6875rem] text-[var(--text-muted)]">
                  {dict["era "]}{<Money cents={sub.previousAmountCents} size="sm" className="inline text-[0.6875rem]" />}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
