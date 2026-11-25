import type { MonthRef } from "./dates";
import type { DetectedSubscription } from "./subscriptions";

/** Inclusive civil day, clamped to the selected month's last day. */
export function endOfCutoffDay(ref: MonthRef, day: number) {
  const last = new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate();
  return new Date(Date.UTC(ref.year, ref.month - 1, Math.min(last, Math.max(0, Math.floor(day))) + 1));
}

export function annualSubscriptionCents(amountCents: number, cadence: DetectedSubscription["cadence"]) {
  return amountCents * (cadence === "monthly" ? 12 : 1);
}

export type CategorySpending = {
  todayCents: number; historyCents: number; historyCount: number; historyDays: number;
};

/** Same minimum sample, relative threshold and R$10 excess as financialInsightEvents. */
export function isAtypicalCategorySpending(c: CategorySpending) {
  const mean = c.historyCents / 30;
  return c.historyCount >= 5 && c.historyDays >= 3 && mean > 0
    && c.todayCents > mean * 1.5 && c.todayCents - mean >= 1000;
}
