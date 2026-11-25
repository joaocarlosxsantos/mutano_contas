import { Receipt, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import {
  getCategoryBreakdown,
  getMonthSummary,
  getMonthlySeries,
  getTopExpenses,
  getBalances,
  getMonthSummaryThroughDay,
  getAtypicalSpendingToday,
  getDetectedSubscriptions,
} from "@/server/queries";
import { InvestmentSummary } from "@/components/investment-summary";
import { currentMonthRef, formatDayMonth, monthRefFromParam, monthLabel, shiftMonth, todayRef } from "@/lib/dates";
import { formatCents, pct } from "@/lib/money";
import { categoryDeltas, spendingPace } from "@/lib/finance";
import { PageHeader } from "@/components/page-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card, CardHeader } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { EmptyState } from "@/components/ui/empty";
import { FixedVariableChart } from "@/components/charts/monthly-flow";
import { endOfCutoffDay } from "@/lib/insight-metrics";
import { loadSpendingForecast } from "@/server/telegram/spending-forecast";
import { DailyBudgetCard } from "../painel/daily-budget-card";
import { AtypicalSpendingBanner } from "@/components/atypical-spending-banner";
import { SubscriptionAnnualSummary } from "@/components/subscription-annual-summary";

export const metadata = { title: "Insights" };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const userId = await requireUserId();
  const { m } = await searchParams;
  const ref = monthRefFromParam(m);
  const prevRef = shiftMonth(ref, -1);
  const today = currentMonthRef();
  const isCurrentMonth = ref.year === today.year && ref.month === today.month;
  const cutoffDay = Math.min(Number(todayRef().slice(8, 10)), new Date(Date.UTC(prevRef.year, prevRef.month, 0)).getUTCDate());
  const currentEnd = isCurrentMonth ? endOfCutoffDay(ref, cutoffDay) : undefined;
  const previousEnd = isCurrentMonth ? endOfCutoffDay(prevRef, cutoffDay) : undefined;

  const [summary, prevSummary, breakdown, prevBreakdown, topExpenses, series, balances, comparisonSummary, comparisonPrevious, dailyAnalysis, atypicalSpending, subscriptions] = await Promise.all([
    getMonthSummary(userId, ref, { cardMode: "cash" }),
    getMonthSummary(userId, prevRef, { cardMode: "cash" }),
    getCategoryBreakdown(userId, ref, { cardMode: "cash", endExclusive: currentEnd }),
    getCategoryBreakdown(userId, prevRef, { cardMode: "cash", endExclusive: previousEnd }),
    getTopExpenses(userId, ref, 6),
    getMonthlySeries(userId, 6, ref, { cardMode: "cash" }),
    getBalances(userId),
    isCurrentMonth ? getMonthSummaryThroughDay(userId, ref, cutoffDay, { cardMode: "cash" }) : null,
    isCurrentMonth ? getMonthSummaryThroughDay(userId, prevRef, cutoffDay, { cardMode: "cash" }) : null,
    isCurrentMonth ? loadSpendingForecast(userId) : null,
    isCurrentMonth ? getAtypicalSpendingToday(userId) : [],
    getDetectedSubscriptions(userId),
  ]);

  const hasData = summary.expenseCents > 0 || summary.incomeCents > 0 || prevSummary.expenseCents > 0;

  const deltas = categoryDeltas(breakdown, prevBreakdown)
    .filter((d) => d.totalCents > 0 || d.previousCents > 0)
    .slice(0, 6);

  const currentExpense = comparisonSummary?.expenseCents ?? summary.expenseCents;
  const previousExpense = comparisonPrevious?.expenseCents ?? prevSummary.expenseCents;
  const expenseChangePct =
    previousExpense > 0
      ? Math.round(((currentExpense - previousExpense) / previousExpense) * 1000) / 10
      : null;

  let pace: ReturnType<typeof spendingPace> | null = null;
  let daysInMonth = 0;
  let dayOfMonth = 0;
  if (isCurrentMonth) {
    const today = todayRef();
    dayOfMonth = Number(today.slice(8, 10));
    daysInMonth = new Date(ref.year, ref.month, 0).getDate();
    pace = spendingPace(summary.expenseCents, dayOfMonth, daysInMonth);
  }

  const withExpense = series.filter((s) => s.saiu > 0);
  const fixedShareFirst = withExpense.length ? pct(withExpense[0].fixo, withExpense[0].saiu) : 0;
  const fixedShareLast = withExpense.length ? pct(withExpense[withExpense.length - 1].fixo, withExpense[withExpense.length - 1].saiu) : 0;
  const fixedShareTrend = fixedShareLast - fixedShareFirst;

  // `deltas` já vem ordenado por |variação| decrescente (ver categoryDeltas) —
  // então a primeira ocorrência positiva/negativa nessa mesma ordem já é a
  // maior alta/queda em módulo. Nada de `.reverse()` aqui: isso pegaria a
  // MENOR variação entre as negativas, o oposto do que "categoria que mais
  // caiu" promete.
  const biggestJump = deltas.find((d) => d.deltaCents > 0);
  const biggestDrop = deltas.find((d) => d.deltaCents < 0);

  return (
    <>
      <PageHeader
        title="Insights"
        description="Um raio-x do seu mês: pra onde o dinheiro está indo, o que mudou desde o mês passado e no que vale prestar atenção."
        action={<MonthSwitcher value={ref} />}
      />

      <AtypicalSpendingBanner items={atypicalSpending} userId={userId} />
      <SubscriptionAnnualSummary subscriptions={subscriptions} />
      <InvestmentSummary balance={balances} />

      {!hasData ? (
        <Card className="min-w-0 p-0">
          <EmptyState
            icon={Receipt}
            title={`Sem dados suficientes em ${monthLabel(ref)}`}
            description="Assim que houver lançamentos neste mês (ou no anterior, pra comparação), os insights aparecem aqui."
          />
        </Card>
      ) : (
        <>
          {dailyAnalysis && <DailyBudgetCard className="mb-4" dailyBudget={dailyAnalysis.daily} spentTodayCents={dailyAnalysis.spentTodayCents} historyDays={dailyAnalysis.historyDays} />}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
              <CardHeader
                title={isCurrentMonth ? "Ritmo de gastos deste mês" : `Comparado a ${monthLabel(prevRef)}`}
                subtitle={
                  isCurrentMonth
                    ? `Já se passaram ${dayOfMonth} de ${daysInMonth} dias do mês.`
                    : "Como este mês se compara ao anterior."
                }
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="muted text-[0.8125rem]">{isCurrentMonth ? `Gasto até o dia ${cutoffDay}` : "Gasto do mês"}</p>
                  <p className="tnum text-xl font-semibold tracking-tight">{formatCents(currentExpense)}</p>
                  {isCurrentMonth && <p className="muted mt-1 text-xs">{monthLabel(prevRef)} até o dia {cutoffDay}: {formatCents(previousExpense)}</p>}
                  {isCurrentMonth && pace ? (
                    <p className="muted mt-1 text-xs">Média do mês até o dia {dayOfMonth}: {formatCents(pace.dailyAvgCents)}/dia</p>
                  ) : null}
                </div>
                <div>
                  <p className="muted text-[0.8125rem]">
                    {isCurrentMonth ? `Projeção de fechamento (gastos até o dia ${dayOfMonth})` : `Gasto em ${monthLabel(prevRef)}`}
                  </p>
                  <p className="tnum text-xl font-semibold tracking-tight">
                    {formatCents(isCurrentMonth && pace ? pace.projectedCents : prevSummary.expenseCents)}
                  </p>
                  {expenseChangePct !== null ? (
                    <p
                      className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                        expenseChangePct > 0
                          ? "text-[var(--text-out)]"
                          : expenseChangePct < 0
                            ? "text-[var(--text-in)]"
                            : "muted"
                      }`}
                    >
                      {expenseChangePct > 0 ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : expenseChangePct < 0 ? (
                        <ArrowDownRight className="size-3.5" />
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                      {Math.abs(expenseChangePct)}% {expenseChangePct > 0 ? "a mais" : expenseChangePct < 0 ? "a menos" : "igual"} que{" "}
                      {monthLabel(prevRef)}{isCurrentMonth ? `, até o dia ${cutoffDay} nos dois meses` : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              {isCurrentMonth && pace && pace.projectedCents > 0 ? (
                <Hint
                  className="mt-4"
                  tone={expenseChangePct !== null && expenseChangePct > 15 ? "warn" : "tip"}
                >
                  No ritmo atual, você deve fechar {monthLabel(ref)} gastando cerca de{" "}
                  <strong>{formatCents(pace.projectedCents)}</strong>
                  {prevSummary.expenseCents > 0 ? (
                    <>
                      {" "}
                      — {pace.projectedCents > prevSummary.expenseCents ? "mais" : pace.projectedCents < prevSummary.expenseCents ? "menos" : "o mesmo"} que os {formatCents(prevSummary.expenseCents)} do mês completo de{" "}
                      {monthLabel(prevRef)}.
                    </>
                  ) : (
                    "."
                  )}
                </Hint>
              ) : null}
            </Card>

            <Card className="min-w-0 min-w-0">
              <CardHeader title="Fixo x variável" subtitle="Últimos 6 meses." />
              <FixedVariableChart data={series} />
              {withExpense.length > 1 ? (
                <p className="muted mt-2 text-xs leading-relaxed">
                  {Math.abs(fixedShareTrend) < 3
                    ? "A proporção entre fixo e variável está estável nesse período."
                    : fixedShareTrend > 0
                      ? `A fatia de gasto fixo vem crescendo: foi de ${fixedShareFirst}% para ${fixedShareLast}% do gasto do mês.`
                      : `A fatia de gasto fixo vem caindo: foi de ${fixedShareFirst}% para ${fixedShareLast}% do gasto do mês.`}
                </p>
              ) : null}
            </Card>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="min-w-0 lg:col-span-3">
              <CardHeader
                title="Comparativo por categoria"
                subtitle={`O que mudou entre ${monthLabel(prevRef)} e ${monthLabel(ref)}, categoria a categoria.${isCurrentMonth ? ` Até o dia ${cutoffDay} nos dois meses.` : ""}`}
              />
              {deltas.length ? (
                <ul className="divide-y">
                  {deltas.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2.5 text-[0.8125rem]">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                      <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                      <span className="tnum shrink-0">{formatCents(d.totalCents)}</span>
                      <span
                        className={`tnum flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-medium ${
                          d.deltaCents > 0
                            ? "text-[var(--text-out)]"
                            : d.deltaCents < 0
                              ? "text-[var(--text-in)]"
                              : "muted"
                        }`}
                      >
                        {d.deltaCents > 0 ? (
                          <ArrowUpRight className="size-3 shrink-0" />
                        ) : d.deltaCents < 0 ? (
                          <ArrowDownRight className="size-3 shrink-0" />
                        ) : (
                          <Minus className="size-3 shrink-0" />
                        )}
                        {d.deltaPct === null ? "novo" : `${Math.abs(d.deltaPct)}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted py-8 text-center text-[0.8125rem]">
                  Sem gastos suficientes para comparar os dois meses.
                </p>
              )}
            </Card>

            <Card className="min-w-0 lg:col-span-2">
              <CardHeader title="Maiores gastos do mês" subtitle="As compras mais pesadas, uma a uma." />
              {topExpenses.length ? (
                <ul className="divide-y">
                  {topExpenses.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5 text-[0.8125rem]">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: t.categoryColor ?? "var(--text-muted)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.description}</p>
                        <p className="muted text-xs">
                          {formatDayMonth(t.date)} · {t.categoryName ?? "Sem categoria"}
                        </p>
                      </div>
                      <span className="tnum shrink-0 font-semibold">{formatCents(t.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted py-8 text-center text-[0.8125rem]">Nenhum gasto neste mês ainda.</p>
              )}
            </Card>
          </section>

          {biggestJump || biggestDrop ? (
            <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {biggestJump ? (
                <Hint tone="warn" title="Categoria que mais subiu">
                  <strong>{biggestJump.name}</strong> foi de {formatCents(biggestJump.previousCents)} para{" "}
                  {formatCents(biggestJump.totalCents)}
                  {biggestJump.deltaPct !== null ? ` (+${biggestJump.deltaPct}%)` : ""} — vale olhar o que mudou aí.
                </Hint>
              ) : null}
              {biggestDrop ? (
                <Hint tone="good" title="Categoria que mais caiu">
                  <strong>{biggestDrop.name}</strong> foi de {formatCents(biggestDrop.previousCents)} para{" "}
                  {formatCents(biggestDrop.totalCents)} — economia de {formatCents(-biggestDrop.deltaCents)}.
                </Hint>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
