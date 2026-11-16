import { describe, expect, it } from "vitest";
import { todayRef } from "@/lib/dates";
import { isFollowUpQuestion, isListingIntent, scopeSpendingInput, spendingIntent } from "./spending-intent";
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
  it("reconhece intenções de listagem e perguntas de continuação", () => {
    expect(isListingIntent("quais foram as transações?")).toBe(true);
    expect(isListingIntent("quais foram?")).toBe(true);
    expect(isListingIntent("detalha")).toBe(true);
    expect(isListingIntent("lista")).toBe(true);
    expect(isListingIntent("quais compras?")).toBe(true);
    expect(isListingIntent("quanto gastei no total?")).toBe(false);

    expect(isFollowUpQuestion("e no cartão?")).toBe(true);
    expect(isFollowUpQuestion("e na conta?")).toBe(true);
    expect(isFollowUpQuestion("só no crédito")).toBe(true);
    expect(isFollowUpQuestion("quanto gastei este mês?")).toBe(false);
  });
  it("herda período e escopo em follow-ups quando contexto anterior existe", () => {
    const prevContext = { start_date: "2026-11-14", end_date: "2026-11-15", account_scope: "all" as const };
    const listing = spendingIntent("quais foram as transações?", "2026-11-16", prevContext);
    expect(listing).toEqual({ account_scope: "all", start_date: "2026-11-14", end_date: "2026-11-15" });

    const cardFollowUp = spendingIntent("e no cartão?", "2026-11-16", prevContext);
    expect(cardFollowUp).toEqual({ account_scope: "credit_card", start_date: "2026-11-14", end_date: "2026-11-15" });

    const newPeriodQuestion = spendingIntent("gastos no cartão em novembro", "2026-11-16", prevContext);
    expect(newPeriodQuestion).toEqual({ account_scope: "credit_card" });
  });
  it("completa argumentos para list_transactions via scopeSpendingInput", () => {
    const prevContext = { start_date: "2026-11-14", end_date: "2026-11-15", account_scope: "credit_card" as const };
    const scoped = scopeSpendingInput("list_transactions", { start_date: "2026-11-01", end_date: "2026-11-16" }, "e no cartão?", "2026-11-16", prevContext) as Record<string, unknown>;
    expect(scoped).toEqual({ start_date: "2026-11-14", end_date: "2026-11-15", account_scope: "credit_card" });
  });
});
