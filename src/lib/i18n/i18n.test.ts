import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, getIntlLocale, parseLocale } from "./config";
import { en as commonEn, ptBR as commonPt } from "./dictionaries/common";
import { en as landingEn, ptBR as landingPt } from "./dictionaries/landing-auth";
import { getTranslator, translateError } from "./dictionaries";

describe("locale validation", () => {
  it.each([undefined, null, "", "pt-BR", "EN", "en-US", " en", "en; Path=/", "<script>alert(1)</script>"])("defaults safely for %s", value => {
    expect(parseLocale(value)).toBe(DEFAULT_LOCALE);
  });
  it("accepts only the exact English cookie", () => {
    expect(parseLocale("en")).toBe("en");
    expect(getIntlLocale("en")).toBe("en-US");
    expect(getIntlLocale("pt-BR")).toBe("pt-BR");
  });
});

describe("dictionaries", () => {
  it.each([[commonPt, commonEn], [landingPt, landingEn]])("has identical nonempty keys and values", (pt, en) => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
    expect(Object.values(en).every(value => typeof value === "string" && value.trim().length > 0)).toBe(true);
  });
  it("selects translations and translates dynamic validation messages", () => {
    expect(getTranslator("pt-BR")("Entrar")).toBe("Entrar");
    expect(getTranslator("en")("Entrar")).toBe("Sign in");
    expect(translateError("E-mail ou senha incorretos.", "en")).toBe("Incorrect email or password.");
    expect(translateError("Muitas tentativas para esta conta. Tente novamente em 3 minuto(s).", "en")).toContain("3 minute(s)");
    expect(translateError("Informe sua renda ou escolha adiar.", "en")).toBe("Enter your income or choose to set it up later.");
    expect(translateError("Confira os campos.", "pt-BR")).toBe("Confira os campos.");
  });
});
