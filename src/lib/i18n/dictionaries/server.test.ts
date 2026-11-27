import { describe, expect, it, vi } from "vitest";
import { en, ptBR, translateServer } from "./server";
import { calculateCategorySuggestion } from "@/lib/budget-suggestions";
import { buildBudgetAlerts } from "@/lib/alerts";
import { buildBillShareMessage } from "@/lib/whatsapp";
import { buildExportRows, rowsToCsv } from "@/lib/export";
import { getProfileOptions } from "@/lib/usage-profile";
import { getSiteChatCommands } from "@/lib/site-chat";

const state = vi.hoisted(() => ({ locale: "pt-BR" as "pt-BR" | "en" }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => state.locale }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "session-owner" }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/telegram/command-service", () => ({ ownerCommandDependencies: () => ({
  balance: async () => ({ availableCents: 1000, investedCents: 2500, netWorthCents: 3500, totalIncomplete: true, needsOpeningBalance: true }),
}) }));
import { saveUsageProfile } from "@/server/actions/usage-profile";
import { siteCommandReply } from "@/server/telegram/site-chat";

describe("server and pure text localization", () => {
  it("provides matching nonempty PT-BR and English dictionaries", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
    expect(Object.values(en).every(value => value.trim())).toBe(true);
  });

  it("translates propagated validation messages with dynamic limits", () => {
    expect(translateServer("en", "O nome não pode ultrapassar 100 caracteres.")).toBe("Name cannot exceed 100 characters.");
    expect(translateServer("pt-BR", "O nome não pode ultrapassar 100 caracteres.")).toBe("O nome não pode ultrapassar 100 caracteres.");
    expect(translateServer("en", "Dia deve ser um número inteiro.")).toBe("Day must be a whole number.");
    expect(translateServer("en", "Cole somente o valor de Client Secret, sem aspas, espaços ou prefixos.")).toBe("Paste only the Client Secret value, without quotes, spaces or prefixes.");
    expect(translateServer("en", "3 linha(s) foram ignoradas por não ter data ou valor válidos.")).toBe("3 row(s) skipped because the date or amount was invalid.");
    expect(translateServer("en", 'Nomes duplicados não são permitidos: "Ana".')).toBe('Duplicate names are not allowed: "Ana".');
    expect(translateServer("en", "Autenticação Pluggy rejeitada. Confira as credenciais informadas.")).toBe("Pluggy authentication rejected. Check the credentials provided.");
  });

  it("reads the selected locale for action validation without accepting a client identity", async () => {
    const form = new FormData();
    form.set("usageProfile", "invalid");
    form.set("userId", "another-owner");
    state.locale = "en";
    expect(await saveUsageProfile({}, form)).toEqual({ error: "Choose a valid profile." });
    state.locale = "pt-BR";
    expect(await saveUsageProfile({}, form)).toEqual({ error: "Escolha um perfil válido." });
  });

  it("renders English site commands from the cookie, keeps partial-data caveats and validates the allowlist", async () => {
    state.locale = "en";
    const reply = await siteCommandReply("session-owner", "/saldo");
    expect(reply).toContain("Available: R$10.00");
    expect(reply).toContain("Invested: R$25.00");
    expect(reply).toContain("Partial total");
    expect(reply).toContain("opening balances");
    await expect(siteCommandReply("session-owner", "/saldo other-owner")).rejects.toThrow("invalid_site_command");
    state.locale = "pt-BR";
  });

  it("keeps Portuguese defaults and supports English labels in pure helpers", () => {
    expect(calculateCategorySuggestion([10000]).label).toBe("média 1m");
    expect(calculateCategorySuggestion([10000], "en").label).toBe("1m average");
    expect(getProfileOptions("en")[0].label).toBe("Full integration");
    expect(getSiteChatCommands("en").find(item => item.command === "/saldo")?.label).toBe("Balance");
    const alert = buildBudgetAlerts([{ categoryId: "a", name: "Casa", spentCents: 2000, limitCents: 1000, remainingCents: -1000, status: "estourou" }], "en")[0];
    expect(alert.title).toBe('Budget for "Casa" exceeded');
    expect(alert.description).toContain("R$20.00");
    expect(buildBillShareMessage({ participantName: "Ana", monthLabel: "November", groupingName: null, entries: [{ billName: "Casa", amountCents: 2000 }] }, "en")).toBe("Hi Ana! Your share of *Casa* for November is *R$20.00*.");
  });

  it("localizes CSV headers and enums while preserving numeric BRL and formula protection", () => {
    const rows = buildExportRows([{ date: new Date("2026-11-01T12:00:00Z"), description: "=SUM(A1)", categoryName: null,
      kind: "EXPENSE", nature: "FIXED", accountName: "Minha conta", amountCents: 12345, isTransfer: false,
      installmentNumber: null, installmentTotal: null, recurringRuleId: null, notes: null }], "en");
    expect(rows[0].Categoria).toBe("Uncategorized");
    expect(rows[0]["Valor (R$)"]).toBe(-123.45);
    expect(rows[0].Conta).toBe("Minha conta");
    const csv = rowsToCsv(rows, "en");
    expect(csv).toContain("Date;Description;Category;Type;Expense type;Account;Amount (R$)");
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain(";-123.45;");
    expect(rowsToCsv([])).toContain("Data;Descrição;Categoria");
  });
});
