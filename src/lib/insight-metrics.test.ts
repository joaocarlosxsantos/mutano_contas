import { describe, expect, it } from "vitest";
import { annualSubscriptionCents, endOfCutoffDay, isAtypicalCategorySpending } from "./insight-metrics";

describe("comparison cutoff", () => {
  it("includes day one and the cutoff day without including the next day", () => {
    expect(endOfCutoffDay({ year: 2026, month: 11 }, 1).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(endOfCutoffDay({ year: 2026, month: 11 }, 25).toISOString()).toBe("2026-11-26T00:00:00.000Z");
  });
  it("clamps short months, including leap years and December rollover", () => {
    expect(endOfCutoffDay({ year: 2026, month: 2 }, 31).toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(endOfCutoffDay({ year: 2024, month: 2 }, 31).toISOString()).toBe("2024-03-01T00:00:00.000Z");
    expect(endOfCutoffDay({ year: 2026, month: 12 }, 31).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

it("annualizes monthly charges and increases but counts annual ones only once", () => {
  expect(annualSubscriptionCents(2990, "monthly") + annualSubscriptionCents(19900, "annual")).toBe(55780);
  expect(annualSubscriptionCents(500, "monthly")).toBe(6000);
  expect(annualSubscriptionCents(500, "annual")).toBe(500);
  expect(annualSubscriptionCents(0, "monthly")).toBe(0);
});

describe("atypical category spending", () => {
  const category = { todayCents: 3000, historyCents: 30000, historyCount: 5, historyDays: 3 };
  it("requires enough history, strictly over 150% and at least R$10 excess", () => {
    expect(isAtypicalCategorySpending(category)).toBe(true);
    for (const change of [{ historyCount: 4 }, { historyDays: 2 }, { historyCents: 0 }, { todayCents: 1500 }, { todayCents: 1999 }]) {
      expect(isAtypicalCategorySpending({ ...category, ...change })).toBe(false);
    }
    expect(isAtypicalCategorySpending({ ...category, todayCents: 2000 })).toBe(true);
  });
});
