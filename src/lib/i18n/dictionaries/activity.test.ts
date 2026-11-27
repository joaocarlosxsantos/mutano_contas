import { describe, expect, it } from "vitest";
import { en, ptBR, getActivityDict, getActivityTranslator } from "./activity";

describe("activity dictionary", () => {
  it("has identical nonempty keys and values", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
    expect(Object.values(en).every((value) => typeof value === "string" && value.trim().length > 0)).toBe(true);
    expect(Object.values(ptBR).every((value) => typeof value === "string" && value.trim().length > 0)).toBe(true);
  });

  it("translates known keys in en and pt-BR", () => {
    expect(getActivityDict("pt-BR")["Painel"]).toBe("Painel");
    expect(getActivityDict("en")["Painel"]).toBe("Dashboard");
    expect(getActivityTranslator("en")("Lançamentos")).toBe("Transactions");
    expect(getActivityTranslator("pt-BR")("Lançamentos")).toBe("Lançamentos");
  });
});
