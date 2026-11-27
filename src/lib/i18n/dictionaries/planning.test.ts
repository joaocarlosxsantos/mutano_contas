import { describe, expect, it } from "vitest";
import { en, ptBR, translatePlanning } from "./planning";

describe("planning translations", () => {
  it("provides matching nonempty PT-BR and English dictionaries", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
    expect(Object.values(en).every(value => value.trim())).toBe(true);
    expect(translatePlanning("pt-BR", "Contas a pagar")).toBe("Contas a pagar");
    expect(translatePlanning("en", "Contas a pagar")).toBe("Bills");
    expect(translatePlanning("en", "Salvar")).toBe("Save");
    expect(translatePlanning("en", "Rotativo do cartão")).toBe("Revolving credit card balance");
    expect(translatePlanning("en", "Empréstimo pessoal")).toBe("Personal loan");
    expect(translatePlanning("en", "% a.m.")).toBe("% per month");
  });

  it("preserves arbitrary user values while interpolating translated confirmations", () => {
    const name = "<script> {0} Minha conta";
    expect(translatePlanning("en", 'Excluir a meta "{0}"?', name)).toBe(`Delete the goal "${name}"?`);
    expect(translatePlanning("pt-BR", 'Excluir a meta "{0}"?', name)).toBe(`Excluir a meta "${name}"?`);
  });
});
