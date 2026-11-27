"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useMemo, useState } from "react";
import { Award, CalendarCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, MoneyInput } from "@/components/ui/field";
import { Hint } from "@/components/ui/hint";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { VIZ } from "@/components/charts/palette";
import { formatCents, parseMoneyToCents } from "@/lib/money";
import { compareStrategies, type DebtInput, type PayoffResult } from "@/lib/debts";
import { cn } from "@/lib/cn";

const AVALANCHE_COLOR = VIZ.in;
const SNOWBALL_COLOR = VIZ.balance;
/** Versões escurecidas das mesmas cores, para quando viram texto. */
const AVALANCHE_TEXT = "var(--text-in)";
const SNOWBALL_TEXT = "var(--text-brand)";

export function PayoffPlanner({
  debts,
  suggestedExtraCents,
  totalMinimumCents,
}: {
  debts: DebtInput[];
  suggestedExtraCents: number;
  totalMinimumCents: number;
}) {
  const locale = useLocale();
  const [extra, setExtra] = useState((suggestedExtraCents / 100).toFixed(2).replace(".", locale === "en" ? "." : ","));
  const extraCents = parseMoneyToCents(extra);

  const comparison = useMemo(() => compareStrategies(debts, extraCents), [debts, extraCents]);
  const { avalanche, snowball, interestSavedCents, monthsSaved } = comparison;

  const chartData = useMemo(() => {
    const max = Math.max(avalanche.timeline.length, snowball.timeline.length);
    return Array.from({ length: max }, (_, i) => ({
      label: i === 0 ? translatePlanning(locale, "hoje") : `${i}m`,
      avalanche: avalanche.timeline[i]?.balanceCents ?? 0,
      snowball: snowball.timeline[i]?.balanceCents ?? 0,
    }));
  }, [avalanche, snowball, locale]);

  const impossible = avalanche.impossible ?? snowball.impossible;

  return (
    <Card className="min-w-0">
      <CardHeader
        title={translatePlanning(locale, "Plano de quitação")}
        subtitle={translatePlanning(locale, "Quanto você consegue pagar por mês além dos mínimos muda tudo. Mexa no valor e compare.")}
      />

      <div className="space-y-4">
        <Field
          label={translatePlanning(locale, "Sobra por mês, além dos mínimos")}
          hint={translatePlanning(locale, "Os mínimos já somam {0}.", formatCents(totalMinimumCents, locale))}
          className="max-w-64"
        >
          <MoneyInput className="min-h-12 min-w-0 max-w-full text-base!" value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" />
        </Field>

        {impossible ? (
          <Hint tone="warn" title={translatePlanning(locale, "Assim a dívida nunca acaba")}>
            {translatePlanning(locale, "Com esse valor, o pagamento não cobre nem os juros do mês — faltam")}{" "}
            <strong>{formatCents(impossible.shortfallCents, locale)}</strong> {translatePlanning(locale, "e o saldo cresce todo mês. Aqui o caminho não é apertar mais o orçamento: é")} <strong>{translatePlanning(locale, "renegociar a taxa")}</strong> {translatePlanning(locale, "ou trocar a dívida cara por uma mais barata (portabilidade, empréstimo com garantia).")} </Hint>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StrategyCard
              title={translatePlanning(locale, "Avalanche")}
              subtitle={translatePlanning(locale, "Ataca a dívida de maior juros")}
              result={avalanche}
              color={AVALANCHE_COLOR}
              textColor={AVALANCHE_TEXT}
              winner
            />
            <StrategyCard
              title={translatePlanning(locale, "Bola de neve")}
              subtitle={translatePlanning(locale, "Ataca a dívida de menor saldo")}
              result={snowball}
              color={SNOWBALL_COLOR}
              textColor={SNOWBALL_TEXT}
            />
          </div>
        )}
      </div>

      {!impossible ? (
        <>
          <div className="mt-5 min-w-0 max-w-full">
            <ProjectionChart
              title={translatePlanning(locale, "Saldo devedor: avalanche e bola de neve")}
              data={chartData}
              area={false}
              series={[
                { key: "avalanche", name: translatePlanning(locale, "Avalanche"), color: AVALANCHE_COLOR },
                { key: "snowball", name: translatePlanning(locale, "Bola de neve"), color: SNOWBALL_COLOR, dash: "4 4" },
              ]}
            />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Hint tone={interestSavedCents > 0 ? "info" : "good"}>
              {interestSavedCents > 0 ? (
                <>
                  {translatePlanning(locale, "A avalanche economiza")} <strong>{formatCents(interestSavedCents, locale)}</strong> {translatePlanning(locale, "de juros")} {monthsSaved > 0 ? translatePlanning(locale, " e termina {0} {1} antes", monthsSaved, monthsSaved === 1 ? translatePlanning(locale, "mês") : translatePlanning(locale, "meses")) : ""}{translatePlanning(locale, ". Mas se você precisa ver uma dívida sumir para não desistir, a bola de neve custa essa diferença e vale a pena — o plano que você abandona é o mais caro de todos.")} </>
              ) : (
                <>
                  {translatePlanning(locale, "Com essas dívidas, as duas estratégias dão praticamente no mesmo. Escolha a que te motiva mais a continuar.")} </>
              )}
            </Hint>

            <div className="rounded-xl border p-4">
              <p className="text-[0.8125rem] font-medium">{translatePlanning(locale, "Quando cada dívida acaba")}</p>
              <p className="muted mb-2 text-xs">
                {translatePlanning(locale, "Seguindo a avalanche. Uma dívida pequena pode terminar antes só pelo mínimo dela.")} </p>
              <ol className="space-y-1.5">
                {avalanche.order.map((step, i) => (
                  <li key={step.debtId} className="flex items-baseline gap-2 text-[0.8125rem]">
                    <span className="muted tnum w-4 shrink-0">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{step.name}</span>
                    <span className="muted tnum shrink-0 text-xs">
                      {translatePlanning(locale, "mês")} {step.monthPaid}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  );
}

function StrategyCard({
  title,
  subtitle,
  result,
  color,
  textColor,
  winner,
}: {
  title: string;
  subtitle: string;
  result: PayoffResult;
  color: string;
  textColor: string;
  winner?: boolean;
}) {
  const locale = useLocale();
  return (
    <div className={cn("rounded-xl border p-4")} style={{ borderColor: color }}>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
        <p className="text-[0.875rem] font-semibold">{title}</p>
        {winner ? (
          <span
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
            style={{
              color: textColor,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            <Award className="size-3" />
            {translatePlanning(locale, "mais barata")} </span>
        ) : null}
      </div>

      <p className="muted mb-3 text-xs">{subtitle}</p>

      <dl className="space-y-2 text-[0.8125rem]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <dt className="muted inline-flex items-center gap-1.5">
            <CalendarCheck className="size-3.5" />
            {translatePlanning(locale, "Livre em")} </dt>
          <dd className="tnum font-semibold">
            {result.months === null
              ? "—"
              : `${result.months} ${result.months === 1 ? translatePlanning(locale, "mês") : translatePlanning(locale, "meses")}`}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <dt className="muted">{translatePlanning(locale, "Juros que você paga")}</dt>
          <dd className="tnum font-semibold text-[var(--text-out)]">
            {formatCents(result.totalInterestCents, locale)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <dt className="muted">{translatePlanning(locale, "Total desembolsado")}</dt>
          <dd className="tnum">{formatCents(result.totalPaidCents, locale)}</dd>
        </div>
      </dl>
    </div>
  );
}
