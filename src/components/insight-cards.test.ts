import { createElement, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { DailyBudgetCard } from "@/app/(app)/painel/daily-budget-card";
import { SubscriptionAnnualSummary } from "./subscription-annual-summary";
import { AtypicalSpendingBanner } from "./atypical-spending-banner";
import type { DetectedSubscription } from "@/lib/subscriptions";

const buttons = vi.hoisted(() => [] as ButtonHTMLAttributes<HTMLButtonElement>[]);
vi.mock("@/components/ui/button", () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => {
    buttons.push(props);
    return createElement("button", { onClick: props.onClick, "aria-label": props["aria-label"] }, props.children);
  },
}));
afterEach(() => {
  buttons.length = 0;
  vi.unstubAllGlobals();
});

it("shows all three daily amounts and warns only below fourteen days", () => {
  const props = { dailyBudget: { dailyAllowanceCents: 10000, remainingTodayCents: 7000, availableForRestOfMonthCents: 20000, daysRemainingWithToday: 3, status: "ok" as const }, spentTodayCents: 3000, historyDays: 13 };
  const html = renderToStaticMarkup(createElement(DailyBudgetCard, props));
  for (const label of ["Cota segura de hoje", "Já gasto hoje", "Restante hoje", "Histórico curto", "100,00", "30,00", "70,00"]) expect(html).toContain(label);
  expect(renderToStaticMarkup(createElement(DailyBudgetCard, { ...props, historyDays: 14 }))).not.toContain("Histórico curto");
});

it("shows annual charge totals and annualized price increases for both cadences", () => {
  const sub: DetectedSubscription = { name: "Mensal", normalizedName: "monthly", currentAmountCents: 1000, cadence: "monthly", hasPriceIncrease: true, priceIncreaseCents: 100, isRegistered: true, lastChargedOn: "2026-11-25", monthOccurrences: 3 };
  const html = renderToStaticMarkup(createElement(SubscriptionAnnualSummary, { subscriptions: [sub, { ...sub, name: "Anual", normalizedName: "annual", cadence: "annual", currentAmountCents: 20000, priceIncreaseCents: 2000 }] }));
  for (const value of ["320,00/ano", "12,00/ano", "20,00/ano"]) expect(html).toContain(value);
  expect(renderToStaticMarkup(createElement(SubscriptionAnnualSummary, { subscriptions: [] }))).toBe("");
});

it("links an atypical expense to its civil day, category and real transaction anchor", () => {
  const html = renderToStaticMarkup(createElement(AtypicalSpendingBanner, { userId: "owner", items: [{ id: "food", name: "Alimentação", day: "2026-11-25", todayCents: 3000, historyCents: 30000, transactionId: "tx-123" }] }));
  expect(html).toContain("Dispensar aviso de Alimentação hoje");
  expect(html).toContain("from=2026-11-25&amp;to=2026-11-25&amp;kind=EXPENSE&amp;cat=food#transaction-tx-123");
  expect(html).not.toContain('role="alert"');
  expect(renderToStaticMarkup(createElement(AtypicalSpendingBanner, { userId: "owner", items: [] }))).toBe("");
});

it.each([true, false])("transfere o foco antes de dispensar o aviso (próximo aviso: %s)", (hasNext) => {
  const order: string[] = [];
  const focusNext = vi.fn(() => order.push("next"));
  const focusContainer = vi.fn(() => order.push("container"));
  const focusedButton = {};
  const notice = {
    contains: (element: unknown) => element === focusedButton,
    nextElementSibling: hasNext ? { focus: focusNext } : null,
    parentElement: { focus: focusContainer },
  };
  const setItem = vi.fn(() => { order.push("storage"); });
  vi.stubGlobal("document", { activeElement: focusedButton });
  vi.stubGlobal("sessionStorage", { setItem });
  vi.stubGlobal("window", { dispatchEvent: vi.fn(() => { order.push("dismiss"); }) });
  const html = renderToStaticMarkup(createElement(AtypicalSpendingBanner, {
    userId: "focus-owner", items: [{ id: `focus-${hasNext}`, name: "Mercado", day: "2026-11-25", todayCents: 3000, historyCents: 30000, transactionId: "tx" }],
  }));
  expect(html).toContain('aria-label="Avisos de gastos atípicos" tabindex="-1"');
  expect(html).toContain('<aside tabindex="-1"');
  buttons[0].onClick!({ currentTarget: { closest: () => notice } } as unknown as MouseEvent<HTMLButtonElement>);
  expect(order).toEqual([hasNext ? "next" : "container", "storage", "dismiss"]);
  expect(setItem).toHaveBeenCalledWith(`atypical:focus-owner:2026-11-25:focus-${hasNext}`, "1");
  expect(hasNext ? focusNext : focusContainer).toHaveBeenCalledOnce();
});
