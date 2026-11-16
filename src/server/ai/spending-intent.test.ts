import { describe, expect, it } from "vitest";
import { todayRef } from "@/lib/dates";
import { scopeSpendingInput, spendingIntent } from "./spending-intent";
import { validToolInput } from "@/server/telegram/ai-policy";

describe("escopo de gastos e fim de semana civil", () => {
  it.each([
    ["quanto gastei?", "all"], ["quanto no cartão?", "credit_card"], ["gastos na conta corrente", "checking"],
    ["cartão e conta corrente", "all"],
  ])("%s", (question, scope) => expect(spendingIntent(question, "2026-11-16")).toEqual({ account_scope: scope }));
  it.each([
    ["2026-11-16T02:30Z", "2026-11-14", "2026-11-15"], // domingo em SP, segunda UTC
    ["2026-11-16T12:00Z", "2026-11-14", "2026-11-15"],
    ["2026-11-14T12:00Z", "2026-11-14", "2026-11-14"], // sem domingo futuro
    ["2026-11-18T12:00Z", "2026-11-14", "2026-11-15"],
  ])("resolve esse fim de semana %s", (now, start, end) => {
    expect(spendingIntent("quanto eu gastei no cartão esse fim de semana?", todayRef(new Date(now))))
      .toEqual({ account_scope: "credit_card", start_date: start, end_date: end });
  });
  it("fim de semana passado durante domingo usa sábado e domingo anteriores", () => {
    expect(spendingIntent("cartão no fim de semana passado", "2026-11-15"))
      .toMatchObject({ start_date: "2026-11-07", end_date: "2026-11-08" });
  });
  it("fixa cartão e período mesmo se modelo esquecer, sem retirar campos inválidos", () => {
    const input = scopeSpendingInput("get_spending_by_category", { start_date: "2026-11-01", end_date: "2026-11-16" }, "cartão esse fim de semana", "2026-11-16") as Record<string, unknown>;
    expect(input).toEqual({ start_date: "2026-11-14", end_date: "2026-11-15", account_scope: "credit_card" });
    expect(validToolInput("get_spending_by_category", { ...input, userId: "B" }, "2026-11-16")).toBeNull();
    expect(validToolInput("get_spending_by_category", { ...input, account_scope: "SQL" }, "2026-11-16")).toBeNull();
  });
});
