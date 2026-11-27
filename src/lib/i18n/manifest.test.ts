import { describe, expect, it, vi } from "vitest";
import type { Locale } from "./config";

const currentLocale = vi.hoisted(() => ({ value: "pt-BR" as Locale }));
vi.mock("@/lib/i18n/server", () => ({
  getLocale: async () => currentLocale.value,
}));

import manifest from "@/app/manifest";

describe("manifest localization", () => {
  it("returns Portuguese manifest by default", async () => {
    currentLocale.value = "pt-BR";
    const data = await manifest();
    expect(data.name).toBe("Mutano Contas");
    expect(data.lang).toBe("pt-BR");
    expect(data.description).toBe(
      "Seu livro-caixa pessoal: gastos fixos e variáveis, reserva de emergência, metas e extratos."
    );
  });

  it("returns English localized manifest when locale is en", async () => {
    currentLocale.value = "en";
    const data = await manifest();
    expect(data.name).toBe("Mutano Contas");
    expect(data.lang).toBe("en");
    expect(data.description).toBe(
      "Your personal ledger: fixed and variable expenses, emergency savings, goals and statements."
    );
  });
});
