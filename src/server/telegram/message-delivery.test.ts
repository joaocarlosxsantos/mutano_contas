import { describe, expect, it, vi } from "vitest";
import { deleteSecretMessage, sendMessageResult } from "./message-delivery";
import type { TelegramMessage } from "./protocol";

const secret = `AQ.${"a".repeat(50)}`;
const message: TelegramMessage = { message_id: 77, text: secret, chat: { id: 123, type: "private" }, from: { id: 123, is_bot: false } };
describe("entrega segura Telegram", () => {
  it("deleteMessage envia somente IDs, nunca texto, e sem token/chave em log", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    expect(await deleteSecretMessage(message, "fake-bot-token", fetch)).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe("https://api.telegram.org/botfake-bot-token/deleteMessage");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ chat_id: 123, message_id: 77 });
    expect(fetch.mock.calls[0][1].body).not.toContain(secret);
  });
  it("não tenta excluir sem message_id; falha de exclusão não expõe a URL com token", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("fake-bot-token private payload"));
    const log = vi.spyOn(console, "error");
    try {
      expect(await deleteSecretMessage({ ...message, message_id: undefined }, "fake-bot-token", fetch)).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
      expect(await deleteSecretMessage(message, "fake-bot-token", fetch)).toBe(false);
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("mensagem pós-ACK protege conteúdo e remove segredos antes do envio", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    expect(await sendMessageResult(message, `💰 <b>Saldo & conta</b> _cartão_ [nome](tg://user?id=1): ${secret}`, undefined, "fake-bot-token", fetch)).toBe(true);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("parse_mode");
    expect(body).toEqual({ chat_id: 123, text: "💰 <b>Saldo & conta</b> _cartão_ [nome](tg://user?id=1): [segredo removido]", protect_content: true });
  });
});
