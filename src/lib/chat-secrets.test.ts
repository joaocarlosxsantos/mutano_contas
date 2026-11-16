import { describe, expect, it } from "vitest";
import { CHAT_SECRET_NOTICE, containsChatSecret, redactChatSecrets } from "./chat-secrets";

describe("segredos fora dos chats", () => {
  it.each([`AQ.${"Ab8R_-.~+/=".repeat(5)}`, `AIza${"a".repeat(35)}`, `sk-ant-${"a".repeat(35)}`, `sk-proj-${"a".repeat(35)}`, `Bearer ${"a".repeat(35)}`])("detecta e remove token sintético sem retornar seu valor", token => {
    const text = `minha chave: ${token}; qual meu saldo?`;
    expect(containsChatSecret(text)).toBe(true);
    expect(redactChatSecrets(text)).not.toContain(token);
    expect(redactChatSecrets(text)).toContain("[segredo removido]");
    expect(CHAT_SECRET_NOTICE).not.toContain(token);
  });
  it.each(["qual meu saldo?", "/start abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG", "Como economizar?", "AQ. teste", undefined])("preserva consultas e códigos de vínculo comuns", text => {
    expect(containsChatSecret(text)).toBe(false);
  });
});
