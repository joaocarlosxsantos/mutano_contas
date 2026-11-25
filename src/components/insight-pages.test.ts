import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  income: 0, expense: 0, previousExpense: 0, comparisonExpense: 0, expectedIncome: 0,
}));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "owner" }));
vi.mock("@/server/queries", () => ({
  getUser: async () => ({ name: "Teste", monthlyIncomeCents: data.expectedIncome, emergencyMonths: 6, usageProfile: "manual" }),
  getMonthSummary: async (_id: string, ref: { month: number }) => ({ incomeCents: ref.month === 3 ? data.income : 0, expenseCents: ref.month === 3 ? data.expense : data.previousExpense, fixedCents: 0, variableCents: 0 }),
  getMonthSummaryThroughDay: async (_id: string, ref: { month: number }) => ({ incomeCents: 0, expenseCents: ref.month === 3 ? data.comparisonExpense : data.previousExpense, fixedCents: 0, variableCents: 0 }),
  getMonthlySeries: async () => [], getCategoryBreakdown: async () => [], getCardCategoryBreakdown: async () => [],
  getTopExpenses: async () => [], getAvgMonthlyCostCents: async () => 0, getTotalSavedCents: async () => 0,
  getEmergencyFundSavedCents: async () => 0, getBudgetOverview: async () => ({ rows: [] }),
  getRecurringStatus: async () => ({ pending: [], pendingIncomeCents: 0, pendingExpenseCents: 0 }),
  getDebtOverview: async () => ({ debts: [] }), getGoals: async () => [], getOnboardingChecklist: async () => ({}),
  getBalances: async () => ({ accounts: [], netWorthCents: 0, investedCents: 0 }),
  getAtypicalSpendingToday: async () => [], getDetectedSubscriptions: async () => [],
}));
vi.mock("@/server/dashboard-forecast", () => ({ getDashboardForecast: async () => ({}) }));
vi.mock("@/server/telegram/spending-forecast", () => ({ loadSpendingForecast: async () => ({
  daily: { dailyAllowanceCents: 0, remainingTodayCents: 0, availableForRestOfMonthCents: 0, daysRemainingWithToday: 1, status: "exceeded" },
  spentTodayCents: 0, historyDays: 0,
}) }));
vi.mock("@/components/month-switcher", () => ({ MonthSwitcher: () => null }));
vi.mock("@/components/recurring-banner", () => ({ RecurringBanner: () => null }));
vi.mock("@/app/(app)/painel/auto-sync", () => ({ AutoSync: () => null }));
vi.mock("@/app/(app)/painel/onboarding-card", () => ({ OnboardingCard: () => null }));

import DashboardPage from "@/app/(app)/painel/page";
import InsightsPage from "@/app/(app)/insights/page";
import { DailyBudgetCard } from "@/app/(app)/painel/daily-budget-card";

function containsDailyBudget(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(containsDailyBudget);
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  return node.type === DailyBudgetCard || containsDailyBudget(node.props.children);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-31T12:00:00Z"));
  Object.assign(data, { income: 0, expense: 0, previousExpense: 0, comparisonExpense: 0, expectedIncome: 0 });
});
afterEach(() => vi.useRealTimers());
const params = () => ({ searchParams: Promise.resolve({ m: "2026-03" }) });

describe("cota diária nas páginas", () => {
  it.each([
    [0, 0, 0, false], [0, 0, 100000, false], [1000, 0, 0, false],
    [1000, 0, 100000, true], [0, 100000, 0, true],
  ])("painel com despesa %i, entrada %i e renda cadastrada %i", async (expense, income, expectedIncome, visible) => {
    Object.assign(data, { expense, income, expectedIncome });
    expect(containsDailyBudget(await DashboardPage(params()))).toBe(visible);
  });
  it("insights não mostra a cota acima do estado vazio", async () => {
    expect(containsDailyBudget(await InsightsPage(params()))).toBe(false);
    data.income = 100000;
    expect(containsDailyBudget(await InsightsPage(params()))).toBe(true);
  });
  it("não mostra cota ao consultar mês encerrado", async () => {
    data.income = data.expectedIncome = 100000;
    const past = { searchParams: Promise.resolve({ m: "2026-02" }) };
    expect(containsDailyBudget(await DashboardPage(past))).toBe(false);
    expect(containsDailyBudget(await InsightsPage(past))).toBe(false);
  });
});

it("distingue comparação até 28/03 da média e projeção até 31/03", async () => {
  Object.assign(data, { expense: 310000, comparisonExpense: 280000, previousExpense: 140000 });
  const html = renderToStaticMarkup(await InsightsPage(params()));
  expect(html).toContain("Gasto até o dia 28");
  expect(html).toContain("2.800,00");
  expect(html).toContain("Média do mês até o dia 31: R$");
  expect(html).toContain("100,00/dia");
  expect(html).toContain("Projeção de fechamento (gastos até o dia 31)");
  expect(html).toContain("3.100,00");
  expect(html).toContain("100% a mais");
});
