import { describe, expect, it } from "vitest";
import { aiCredentialSchema } from "./credentials-schema";

describe("formato BYOK", () => {
  it.each([
    ["claude", `sk-ant-${"a".repeat(90)}`], ["openai", `sk-proj-${"a".repeat(120)}`], ["gemini", `AIza${"a".repeat(35)}`],
  ])("aceita %s e remove espaços externos", (provider, apiKey) => {
    expect(aiCredentialSchema.parse({ provider, apiKey: ` ${apiKey} ` })).toEqual({ provider, apiKey });
  });
  it.each([
    `AIza${"aB3_-".repeat(7)}`,
    `AIza${"a".repeat(34)}`, `AIza${"a".repeat(36)}`,
    `new-google-prefix_${"aB3_-".repeat(10)}`,
    `AQ.${"a".repeat(50)}`, `AQ.${"aB3_-.~+/=".repeat(5)}`,
    "a".repeat(20), "a".repeat(256),
  ])("aceita Gemini sem depender de prefixo ou comprimento fixos", apiKey => {
    expect(aiCredentialSchema.parse({ provider: "gemini", apiKey: ` \r\n\t${apiKey}\r\n ` })).toEqual({ provider: "gemini", apiKey });
  });
  it.each(["a".repeat(19), "a".repeat(257), `${"a".repeat(20)} b`, `${"a".repeat(20)}\nb`, `${"a".repeat(20)}:b`, `${"a".repeat(20)}\u200bb`])("rejeita Gemini fora dos limites ou com caracteres internos inválidos", apiKey => {
    expect(aiCredentialSchema.safeParse({ provider: "gemini", apiKey }).success).toBe(false);
  });
  it.each([
    { provider: "other", apiKey: "a".repeat(40) }, { provider: "claude", apiKey: `sk-${"a".repeat(40)}` },
    { provider: "openai", apiKey: `sk-ant-${"a".repeat(40)}` }, { provider: "gemini", apiKey: "short" },
    { provider: "openai", apiKey: `sk-${"a".repeat(260)}` }, { provider: "claude", apiKey: "sk-ant-abc\r\nx-inject:secret" },
    { provider: "openai", apiKey: `sk-${"a".repeat(40)}`, userId: "victim" },
    ...([".", "~", "+", "/", "="] as const).flatMap(char => [
      { provider: "claude", apiKey: `sk-ant-${"a".repeat(30)}${char}` },
      { provider: "openai", apiKey: `sk-proj-${"a".repeat(30)}${char}` },
    ]),
  ])("rejeita provedor/formato/identidade inválidos", value => {
    expect(aiCredentialSchema.safeParse(value).success).toBe(false);
  });
});
