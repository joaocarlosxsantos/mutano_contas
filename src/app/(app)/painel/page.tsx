import { canUseCapability } from "@/lib/usage-profile";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { investmentPosition } from "@/lib/investments";
import { requireUserId } from "@/lib/auth";
import {
  getAvgMonthlyCostCents,
  getBalances,
  getBudgetOverview,
  getDebtOverview,
  getCardCategoryBreakdown,
  getCategoryBreakdown,
  getEmergencyFundSavedCents,
  getGoals,
  getMonthSummary,
  getMonthlySeries,
  getOnboardingChecklist,
  getRecurringStatus,
  getTotalSavedCents,
  getUser,
} from "@/server/queries";
import { monthRefFromParam, monthRefToParam, monthLabel } from "@/lib/dates";
import { formatCents, pct } from "@/lib/money";
import {
  balanceCents,
  emergencyTargetCents,
  fiftyThirtyTwenty,
  financialHealth,
  monthsOfRunway,
  savingsRate,
} from "@/lib/finance";
import { forecastCalendar } from "@/lib/dashboard-forecast";
import { getDashboardForecast } from "@/server/dashboard-forecast";
import { loadSpendingForecast } from "@/server/telegram/spending-forecast";
import { AtypicalSpendingBanner } from "@/components/atypical-spending-banner";
import { getAtypicalSpendingToday } from "@/server/queries";
import { buildBudgetAlerts, buildGoalAlerts } from "@/lib/alerts";
import { PageHeader } from "@/components/page-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { RecurringBanner } from "@/components/recurring-banner";
import { Money } from "@/components/ui/money";
import { Card, CardHeader } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty";
import { MonthlyFlowChart, FixedVariableChart } from "@/components/charts/monthly-flow";
import { CategoryBars } from "@/components/charts/category-bars";
import { getIntlLocale, type Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";
import { AutoSync } from "./auto-sync";
import { HealthCard } from "./health-card";
import { BudgetCard } from "./budget-card";
import { DebtCard } from "./debt-card";
import { AlertsCard } from "./alerts-card";
import { OnboardingCard } from "./onboarding-card";
import { ForecastCard } from "./forecast-card";
import { DailyBudgetCard } from "./daily-budget-card";

async function resolveLocale(): Promise<Locale> {
  try {
    const { getLocale } = await import("@/lib/i18n/server");
    return await getLocale();
  } catch {
    return "pt-BR";
  }
}

export async function generateMetadata() {
  const locale = await resolveLocale();
  const dict = getActivityDict(locale);
  return { title: dict["Painel"] };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const locale = await resolveLocale();
  const dict = getActivityDict(locale);
  const intlLocale = getIntlLocale(locale);
  const userId = await requireUserId();
  const { m } = await searchParams;
  const ref = monthRefFromParam(m);

  const [
    user,
    summary,
    series,
    breakdown,
    cardBreakdown,
    avgCost,
    saved,
    emergencySaved,
    budget,
    recurring,
    debts,
    goals,
    onboarding,
    balances,
  ] = await Promise.all([
    getUser(userId),
    getMonthSummary(userId, ref, { cardMode: "cash" }),
    getMonthlySeries(userId, 6, ref, { cardMode: "cash" }),
    getCategoryBreakdown(userId, ref, { cardMode: "cash" }),
    getCardCategoryBreakdown(userId, ref),
    getAvgMonthlyCostCents(userId, 3),
    getTotalSavedCents(userId),
    getEmergencyFundSavedCents(userId),
    getBudgetOverview(userId, ref),
    getRecurringStatus(userId, ref),
    getDebtOverview(userId),
    getGoals(userId),
    getOnboardingChecklist(userId),
    getBalances(userId),
  ]);

  const investedAccounts = balances.accounts.filter((a) => a.type === "INVESTMENT");
  const position = investmentPosition(balances);
  const alerts = [...buildBudgetAlerts(budget.rows), ...buildGoalAlerts(goals)];

  const sobrou = balanceCents(summary);
  const rate = savingsRate(summary);
  const costBase = avgCost > 0 ? avgCost : Math.round(user.monthlyIncomeCents * 0.7);
  const emergencyTarget = emergencyTargetCents(costBase, user.emergencyMonths);
  const runway = monthsOfRunway(emergencySaved, costBase);
  const split = fiftyThirtyTwenty(user.monthlyIncomeCents || summary.incomeCents);

  const fixedShare = user.monthlyIncomeCents
    ? pct(summary.fixedCents, user.monthlyIncomeCents)
    : pct(summary.fixedCents, summary.incomeCents || 1);

  const health = financialHealth({
    savingsRatePct: rate,
    runwayMonths: runway,
    emergencyMonthsTarget: user.emergencyMonths,
    fixedShareOfIncomePct: fixedShare,
  });

  const hasData = summary.incomeCents > 0 || summary.expenseCents > 0 || cardBreakdown.length > 0;

  const now = new Date();
  const calendar = forecastCalendar(ref, now);
  const isCurrentMonth = calendar.period === "current";

  const forecast = await getDashboardForecast(userId, ref, {
    now,
    expectedIncomeCents: user.monthlyIncomeCents,
    pendingRules: canUseCapability(user.usageProfile, "manual-entry") ? recurring.pending : [],
  });

  const [dailyAnalysis, atypicalSpending] = await Promise.all([
    isCurrentMonth ? loadSpendingForecast(userId, undefined, now) : null,
    isCurrentMonth ? getAtypicalSpendingToday(userId, now) : [],
  ]);

  return (
    <>
      {canUseCapability(user.usageProfile, "integration") && <AutoSync />}
      <PageHeader
        title={`${dict["Olá, "]}${user.name.split(" ")[0]}`}
        description={dict["Resumo do mês: entradas, saídas e saldo."]}
        action={<MonthSwitcher value={ref} />}
      />

      <AtypicalSpendingBanner items={atypicalSpending} userId={userId} />

      {/* 1. Hero mês: 'Sobrou' grande + linha Entrou/Saiu/Fixo menores */}
      <section
        className="card min-w-0 p-4 sm:p-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-8"
        aria-label={dict["Resumo financeiro do mês"]}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <span className="text-[0.75rem] font-semibold tracking-normal text-[var(--text-muted)]">
              {dict["Sobrou no mês"]}
            </span>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <Money
                cents={sobrou}
                tone={sobrou < 0 ? "out" : undefined}
                size="hero"
                className="font-semibold"
              />
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {sobrou >= 0
                  ? `${dict["Taxa de economia:"]} ${rate}% ${dict["da renda"]}`
                  : dict["Gastos superaram as receitas no mês"]}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-3 gap-2 border-t border-[var(--border)] pt-3 sm:mt-5 sm:gap-0 sm:divide-x sm:divide-[var(--border)] sm:pt-4 lg:mt-0 lg:border-t-0 lg:pt-0">
          <div className="min-w-0 sm:pr-4">
            <p className="text-[0.75rem] font-medium tracking-normal text-[var(--text-muted)]">
              {dict["Entrou"]}
            </p>
            <div className="mt-1">
              <Money
                cents={summary.incomeCents}
                tone="in"
                size="md"
                className="text-sm sm:text-base font-medium"
              />
            </div>
            <p className="muted mt-0.5 hidden text-xs sm:block truncate">
              {dict["Salário e receitas"]}
            </p>
          </div>

          <div className="min-w-0 sm:px-4">
            <p className="text-[0.75rem] font-medium tracking-normal text-[var(--text-muted)]">
              {dict["Saiu"]}
            </p>
            <div className="mt-1">
              <Money
                cents={summary.expenseCents}
                tone="out"
                size="md"
                className="text-sm sm:text-base font-medium"
              />
            </div>
            <p className="muted mt-0.5 hidden text-xs sm:block truncate">
              {formatCents(summary.variableCents, locale)} {dict["variável"]}
            </p>
          </div>

          <div className="min-w-0 sm:pl-4">
            <p className="text-[0.75rem] font-medium tracking-normal text-[var(--text-muted)]">
              {dict["Fixo"]}
            </p>
            <div className="mt-1">
              <Money
                cents={summary.fixedCents}
                size="md"
                className="text-sm sm:text-base font-medium"
              />
            </div>
            <p className="muted mt-0.5 hidden text-xs sm:block truncate">
              {fixedShare > 0 ? `${fixedShare}% ${dict["da renda"]}` : dict["Compromissos"]}
            </p>
          </div>
        </div>
      </section>

      <section className={`mt-4 space-y-3 ${isCurrentMonth && hasData ? "lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0" : ""}`} aria-label={dict["Ritmo e previsões"]}>
        {hasData && (user.monthlyIncomeCents > 0 || summary.incomeCents > 0) && dailyAnalysis && <DailyBudgetCard locale={locale} dailyBudget={dailyAnalysis.daily} spentTodayCents={dailyAnalysis.spentTodayCents} historyDays={dailyAnalysis.historyDays} />}
        <ForecastCard locale={locale} forecast={forecast} monthName={monthLabel(ref, locale)} />
      </section>

      {investedAccounts.length > 0 ? (
        <section className="mt-4" aria-label={dict["Investimentos"]}>
          <Card className="min-w-0">
            <CardHeader
              title={dict["Investimentos"]}
              subtitle={dict["Saldo atual. Aplicações e resgates ficam fora de Entrou/Saiu; impostos contam como despesa."]}
              action={
                <Link href="/contas" className="inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-brand-600 hover:underline dark:text-brand-300">
                  {dict["Ver contas"]}
                </Link>
              }
            />
            <Money cents={balances.investedCents} size="lg" className="text-2xl font-semibold" />
            {position.incomplete ? <p className="muted mt-1 text-xs">{dict["Saldo parcial: há investimento sem saldo atualizado."]}</p> : null}
            {position.sharePct !== null ? <p className="muted mt-1 text-xs">{position.sharePct.toLocaleString(intlLocale)}% {dict["do patrimônio líquido"]}</p> : null}
            <ul className="mt-3 divide-y divide-[var(--border)] text-[0.8125rem]">
              {investedAccounts.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="muted min-w-0 truncate">{a.name}{a.bankBalanceAt ? ` · ${dict["atualizado em"]} ${new Date(a.bankBalanceAt).toLocaleDateString(intlLocale)}` : ""}</span>
                  {a.financeMode === "integracao" && a.bankBalanceCents === null ? <span className="muted">{dict["Sem saldo atualizado"]}</span> : <Money cents={a.balanceCents} size="sm" className="font-medium" />}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {/* 2. Alerta/onboarding compacta logo abaixo */}
      <div className="mt-4 space-y-3">
        {onboarding.journey ? <OnboardingCard journey={onboarding.journey} profile={user.usageProfile} userId={userId} /> : null}

        {canUseCapability(user.usageProfile, "manual-entry") && (<RecurringBanner
          monthRef={ref}
          monthName={monthLabel(ref, locale)}
          count={recurring.pending.length}
          incomeCents={recurring.pendingIncomeCents}
          expenseCents={recurring.pendingExpenseCents}
        />)}

        <AlertsCard alerts={alerts} locale={locale} />

        {!hasData ? (
          <Card className="min-w-0 p-0">
            <EmptyState
              icon={Receipt}
              title={`${dict["Nenhum lançamento em "]}${monthLabel(ref, locale)}`}
              description={canUseCapability(user.usageProfile, "manual-entry") ? dict["Use o botão + para lançar uma movimentação."] : dict["Conecte suas contas para receber as movimentações."]}
              action={canUseCapability(user.usageProfile, "manual-entry") ? (
                <Link href="/lancamentos" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--acento)] px-4 text-sm font-medium text-[var(--on-acento)]">{dict["Ver lançamentos"]}</Link>
              ) : <Link href="/configuracoes/integracao" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--acento)] px-4 text-sm font-medium text-[var(--on-acento)]">{dict["Conectar e sincronizar"]}</Link>}
            />
          </Card>
        ) : null}
      </div>

      {/* 3. Gráfico 6m + ranking categorias lado-a-lado */}
      <section className="mt-6 grid min-w-0 w-full max-w-full grid-cols-1 gap-4 overflow-x-hidden lg:grid-cols-12" aria-label={dict["Fluxo e categorias"]}>
        <Card className="min-w-0 min-w-0 max-w-full overflow-x-hidden lg:col-span-7">
          <CardHeader
            title={dict["Entrou, saiu e sobrou nos últimos 6 meses"]}
            mobileTitle={dict["Fluxo dos últimos 6 meses"]}
            subtitle={dict["Histórico de entradas, saídas e saldo líquido mês a mês."]}
          />
          <MonthlyFlowChart data={series} />
        </Card>

        <Card className="min-w-0 min-w-0 max-w-full overflow-x-hidden lg:col-span-5">
          <CardHeader
            title={`${dict["Para onde foi o dinheiro em "]}${monthLabel(ref, locale)}`}
            subtitle={dict["Ranking das categorias que mais pesaram no mês."]}
          />
          {breakdown.length ? (
            <CategoryBars slices={breakdown} />
          ) : (
            <p className="muted py-8 text-center text-[0.8125rem]">
              {dict["Sem despesas registradas neste mês."]}
            </p>
          )}
        </Card>
      </section>

      {cardBreakdown.length ? (
        <section className="mt-4" aria-label={dict["Gastos no cartão de crédito"]}>
          <Card className="min-w-0">
            <CardHeader
              title={`${dict["Faturas de cartão de "]}${monthLabel(ref, locale)}`}
              subtitle={dict["Demonstrativo de compras faturadas no cartão de crédito."]}
              action={
                <Link
                  href={`/lancamentos?acc=CARD&m=${monthRefToParam(ref)}`}
                  className="inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-brand-600 hover:underline dark:text-brand-300"
                >
                  {dict["Ver lançamentos do cartão"]}
                </Link>
              }
            />
            <CategoryBars slices={cardBreakdown} />
          </Card>
        </section>
      ) : null}

      {/* 4. Seções planas em 2 colunas desktop */}
      <section
        className="mt-8 border-t border-[var(--border)] pt-8"
        aria-label={dict["Planejamento e saúde financeira"]}
      >
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Coluna 1: Saúde Financeira, Orçamento & Fixo x Variável */}
          <div className="min-w-0 space-y-8 [&_.card]:border-0 [&_.card]:bg-transparent [&_.card]:p-0 [&_.card]:shadow-none [&_.card]:rounded-none">
            <div>
              <HealthCard locale={locale} health={health} className="border-0 bg-transparent p-0 rounded-none shadow-none" />
            </div>

            <div className="min-w-0 border-t border-[var(--border)] pt-6">
              <BudgetCard locale={locale} overview={budget} monthRef={ref} className="border-0 bg-transparent p-0 rounded-none shadow-none" />
            </div>

            <div className="border-t border-[var(--border)] pt-6">
              <div className="mb-4 border-b border-[var(--line)] pb-3">
                <h2 className="text-[0.75rem] font-semibold tracking-normal text-[var(--text-muted)]">
                  {dict["Gasto fixo x variável"]}
                </h2>
                <p className="muted mt-1 text-[0.8125rem] leading-snug">
                  {dict["Evolução de compromissos fixos e gastos controláveis nos últimos 6 meses."]}
                </p>
              </div>
              <div className="min-w-0 max-w-full overflow-hidden">
                <FixedVariableChart data={series} />
              </div>
              <div className="mt-3">
                <Hint tone={fixedShare > 60 ? "warn" : "tip"}>
                  {fixedShare > 0 ? (
                    <>
                      {dict["Gastos fixos consomem "]}<strong>{fixedShare}%</strong> {dict["da renda"]}.{" "}
                      {fixedShare > 60
                        ? dict["Acima de 60% o orçamento engessa e reduz flexibilidade."]
                        : dict["Abaixo de 50% é o equilíbrio ideal para absorver imprevistos."]}
                    </>
                  ) : (
                    <>{dict["Classifique lançamentos como fixo ou variável para esta análise."]}</>
                  )}
                </Hint>
              </div>
            </div>
          </div>

          {/* Coluna 2: Reserva de Emergência, Dívidas & 50/30/20 */}
          <div className="min-w-0 space-y-8 [&_.card]:border-0 [&_.card]:bg-transparent [&_.card]:p-0 [&_.card]:shadow-none [&_.card]:rounded-none">
            {/* Reserva de Emergência */}
            <div id="reserva-emergencia" className="scroll-mt-20">
              <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--line)] pb-3">
                <div className="min-w-0">
                  <h2 className="text-[0.75rem] font-semibold tracking-normal text-[var(--text-muted)]">
                    {dict["Reserva de emergência"]}
                  </h2>
                  <p className="muted mt-1 text-[0.8125rem] leading-snug">
                    {dict["Meta de "]}{user.emergencyMonths}{dict[" meses de custo de vida."]}
                  </p>
                </div>
                <Link
                  href="/metas"
                  className="inline-flex min-h-11 items-center shrink-0 text-[0.8125rem] font-medium text-brand-600 hover:underline dark:text-brand-300"
                >
                  {dict["Gerenciar"]}
                </Link>
              </div>

              <div className="mb-2 flex items-baseline justify-between">
                <Money cents={emergencySaved} size="lg" className="text-2xl font-semibold" />
                <span className="muted text-[0.8125rem]">
                  {dict["de "]}{<Money cents={emergencyTarget} size="sm" />}
                </span>
              </div>
              <Progress
                label={dict["Progresso da reserva de emergência"]}
                value={emergencyTarget ? (emergencySaved / emergencyTarget) * 100 : 0}
                color="var(--color-save)"
                height={8}
              />
              <p className="muted mt-2 text-xs leading-relaxed">
                {dict["Base de cálculo: custo de vida de "]}<strong>{formatCents(costBase, locale)}</strong>{dict[" por mês"]}
                {avgCost > 0 ? dict[" (média real recente)"] : dict[" (estimado em 70% da renda)"]}
                {saved > emergencySaved ? `${dict[" · Total em metas: "]}${formatCents(saved, locale)}` : ""}.
              </p>
              <div className="mt-3">
                <Hint tone={runway >= user.emergencyMonths ? "good" : "info"}>
                  {runway >= user.emergencyMonths
                    ? dict["Reserva completa. O excedente pode ir para investimentos de longo prazo."]
                    : `${runway === 1 ? dict["Cobre 1 mês sem renda."] : `${dict["Cobre "]}${runway}${dict[" meses sem renda."]}`}${dict[" Faltam "]}${formatCents(Math.max(0, emergencyTarget - emergencySaved), locale)}${dict[" para a meta."]}`}
                </Hint>
              </div>
            </div>

            {/* Dívidas */}
            {debts.debts.length > 0 ? (
              <div className="border-t border-[var(--border)] pt-6">
                <DebtCard
                  locale={locale}
                  overview={debts}
                  incomeCents={user.monthlyIncomeCents}
                  className="border-0 bg-transparent p-0 rounded-none shadow-none"
                />
              </div>
            ) : null}

            {/* 50/30/20 */}
            <div className="border-t border-[var(--border)] pt-6">
              <div className="mb-4 border-b border-[var(--line)] pb-3">
                <h2 className="text-[0.75rem] font-semibold tracking-normal text-[var(--text-muted)]">
                  {dict["Como dividir a sua renda"]}
                </h2>
                <p className="muted mt-1 text-[0.8125rem] leading-snug">
                  {dict["Referência 50/30/20 aplicada à sua renda mensal."]}
                </p>
              </div>

              <ul className="space-y-4">
                <SplitRow
                  label={dict["Essenciais"]}
                  hint={dict["Moradia, contas, mercado, transporte, saúde"]}
                  target={split.necessitiesCents}
                  actual={summary.fixedCents}
                  color="var(--text-brand)"
                  share={50}
                  dict={dict}
                />
                <SplitRow
                  label={dict["Estilo de vida"]}
                  hint={dict["Lazer, delivery, assinaturas, compras"]}
                  target={split.wantsCents}
                  actual={summary.variableCents}
                  color="var(--color-variable)"
                  share={30}
                  dict={dict}
                />
                <SplitRow
                  label={dict["Futuro"]}
                  hint={dict["Reserva, investimentos e quitação de dívidas"]}
                  target={split.futureCents}
                  actual={Math.max(0, sobrou)}
                  color="var(--color-money-in)"
                  share={20}
                  dict={dict}
                />
              </ul>
              <p className="muted mt-3 text-xs leading-relaxed">
                {dict["Referência para equilibrar gastos essenciais, estilo de vida e metas."]}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SplitRow({
  label,
  hint,
  target,
  actual,
  color,
  share,
  dict,
}: {
  label: string;
  hint: string;
  target: number;
  actual: number;
  color: string;
  share: number;
  dict: Record<string, string>;
}) {
  const ratio = target ? (actual / target) * 100 : 0;
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.875rem] font-medium">
          <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
          {label}
          <span className="muted text-xs font-normal">{share}%</span>
        </span>
        <span className="text-[0.8125rem]">
          <strong><Money cents={actual} size="sm" /></strong>
          <span className="muted"> / <Money cents={target} size="sm" /></span>
        </span>
      </div>
      <Progress value={ratio} color={color} label={`${label}${dict[": quanto do sugerido já foi usado"]}`} />
      <p className="muted mt-1 text-xs">{hint}</p>
    </li>
  );
}
