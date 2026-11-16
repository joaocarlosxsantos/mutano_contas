import { describe, expect, it } from "vitest";
import { aiCredentialSchema } from "./credentials-schema";

describe("formato BYOK", () => {
  it.each([
    ["claude", `sk-ant-${"a".repeat(90)}`], ["openai", `sk-proj-${"a".repeat(120)}`], ["gemini", `AIza${"a".repeat(35)}`],
  ])("aceita %s e remove espaços externos", (provider, apiKey) => {
    expect(aiCredentialSchema.parse({ provider, apiKey: ` ${apiKey} ` })).toEqual({ provider, apiKey });
  });
  it.each([
    { provider: "other", apiKey: "a".repeat(40) }, { provider: "claude", apiKey: `sk-${"a".repeat(40)}` },
    { provider: "openai", apiKey: `sk-ant-${"a".repeat(40)}` }, { provider: "gemini", apiKey: "short" },
    { provider: "openai", apiKey: `sk-${"a".repeat(260)}` }, { provider: "claude", apiKey: "sk-ant-abc\r\nx-inject:secret" },
    { provider: "openai", apiKey: `sk-${"a".repeat(40)}`, userId: "victim" },
  ])("rejeita provedor/formato/identidade inválidos", value => {
    expect(aiCredentialSchema.safeParse(value).success).toBe(false);
  });
});
