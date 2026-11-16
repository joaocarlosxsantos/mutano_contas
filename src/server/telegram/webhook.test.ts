import { describe, expect, it, vi } from "vitest";
import { handleWebhook, TELEGRAM_MESSAGE_TIMEOUT_MS, type MessageDelivery } from "./webhook";
import { MAX_BODY_BYTES } from "./protocol";
import { CHAT_SECRET_NOTICE } from "@/lib/chat-secrets";

const payload = { update_id: 1, message: { chat: { id: 123, type: "private" }, from: { id: 123, is_bot: false }, text: "/saldo" } };
const request = (body: unknown = payload, secret = "secret") => new Request("https://app.test/api/telegram/webhook", {
  method: "POST", headers: { "x-telegram-bot-api-secret-token": secret }, body: JSON.stringify(body),
});

describe("webhook Telegram", () => {
  it("processador pendente envia falha em 50s dentro do maxDuration60", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const tasks: (() => Promise<void>)[] = [];
      const send = vi.fn().mockResolvedValue(true);
      await handleWebhook(request({ ...payload, message: { ...payload.message, text: "saldo?" } }), "secret", () => new Promise(() => {}), undefined, undefined,
        { remove: vi.fn(), background: { schedule: task => tasks.push(task), send } });
      const pending = tasks[0]();
      await vi.advanceTimersByTimeAsync(TELEGRAM_MESSAGE_TIMEOUT_MS);
      await pending;
      expect(send.mock.calls[0][1]).toContain("Tente de novo");
    } finally { vi.useRealTimers(); log.mockRestore(); }
  });
  it.each([`AQ.${"a".repeat(50)}`, `AIza${"a".repeat(35)}`, `sk-ant-${"a".repeat(35)}`, `sk-proj-${"a".repeat(35)}`, `texto ${"x".repeat(520)} AQ.${"a".repeat(50)}`])("segredo é excluído/avisado sem processador, trabalho pendente ou logs", async token => {
    const process = vi.fn(); const remove = vi.fn().mockResolvedValue(true); const schedule = vi.fn(); const send = vi.fn();
    const logs = [vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    try {
      const body = { ...payload, message: { ...payload.message, message_id: 77, text: `saldo ${token}` } };
      const response = await handleWebhook(request(body), "secret", process, undefined, undefined, { remove, background: { schedule, send } });
      expect(await response.json()).toEqual({ method: "sendMessage", chat_id: 123, text: CHAT_SECRET_NOTICE, protect_content: true });
      expect(remove).toHaveBeenCalledWith({ ...payload.message, message_id: 77, text: CHAT_SECRET_NOTICE });
      expect(process).not.toHaveBeenCalled(); expect(schedule).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
      for (const log of logs) expect(log).not.toHaveBeenCalled();
    } finally { for (const log of logs) log.mockRestore(); }
  });
  it("falha na exclusão preserva aviso sem repetir chave", async () => {
    const token = `AQ.${"a".repeat(50)}`;
    const delivery: MessageDelivery = { remove: vi.fn().mockRejectedValue(new Error(token)), background: { schedule: vi.fn(), send: vi.fn() } };
    const response = await handleWebhook(request({ ...payload, message: { ...payload.message, message_id: 77, text: token } }), "secret", vi.fn(), undefined, undefined, delivery);
    expect((await response.json()).text).toBe(CHAT_SECRET_NOTICE);
  });
  it("ACK precede IA; resultado é enviado pelo trabalho after sem ecoar segredos", async () => {
    const tasks: (() => Promise<void>)[] = [];
    const token = `AQ.${"a".repeat(50)}`;
    const process = vi.fn().mockResolvedValue(`saldo ${token}`); const send = vi.fn().mockResolvedValue(true);
    const message = { ...payload.message, text: "qual meu saldo?" };
    const response = await handleWebhook(request({ ...payload, message }), "secret", process, undefined, undefined,
      { remove: vi.fn(), background: { schedule: task => tasks.push(task), send } });
    expect(await response.json()).toEqual({ ok: true }); expect(process).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
    await tasks[0]();
    expect(process).toHaveBeenCalledWith(1, message);
    expect(send).toHaveBeenCalledWith(message, "saldo [segredo removido]", undefined);
  });
  it("erro após ACK entrega aviso amigável e log estático", async () => {
    const tasks: (() => Promise<void>)[] = [];
    const token = `AQ.${"a".repeat(50)}`;
    const process = vi.fn().mockRejectedValue(Object.assign(new Error(token), { code: token })); const send = vi.fn().mockResolvedValue(true);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await handleWebhook(request({ ...payload, message: { ...payload.message, text: "saldo?" } }), "secret", process, undefined, undefined,
        { remove: vi.fn(), background: { schedule: task => tasks.push(task), send } });
      await tasks[0]();
      expect(send.mock.calls[0][1]).toContain("Tente de novo");
      expect(JSON.stringify(log.mock.calls)).not.toContain(token);
      expect(log).toHaveBeenCalledWith("[telegram-webhook]", { code: "message_processing_failed" });
    } finally { log.mockRestore(); }
  });
  it("saída síncrona e campos de erro não ecoam chave", async () => {
    const token = `AQ.${"a".repeat(50)}`;
    expect((await (await handleWebhook(request(), "secret", vi.fn().mockResolvedValue(token))).json()).text).toBe("[segredo removido]");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await handleWebhook(request(), "secret", vi.fn().mockRejectedValue(Object.assign(new Error(token), { name: token, code: token })));
      expect(JSON.stringify(log.mock.calls)).not.toContain(token);
    } finally { log.mockRestore(); }
  });
  it("rejeita falta de segredo de configuração e segredo inválido antes de processar", async () => {
    const process = vi.fn();
    expect((await handleWebhook(request(), undefined, process)).status).toBe(503);
    expect((await handleWebhook(request(payload, "wrong"), "secret", process)).status).toBe(401);
    expect(process).not.toHaveBeenCalled();
  });
  it("responde pelo webhook sem parse_mode ou dados no resultado HTTP de erro", async () => {
    const process = vi.fn().mockResolvedValue("Saldo: R$ 10,00");
    const result = await handleWebhook(request(), "secret", process);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual({ method: "sendMessage", chat_id: 123, text: "Saldo: R$ 10,00", protect_content: true });
    expect(process).toHaveBeenCalledWith(1, payload.message);
  });
  it.each([
    { ...payload, message: { ...payload.message, chat: { id: -123, type: "group" } } },
    { ...payload, message: { ...payload.message, text: "x".repeat(513) } },
    { update_id: 2, edited_message: payload.message },
    { update_id: 3 },
  ])("ignora update não suportado", async (body) => {
    const process = vi.fn();
    expect((await handleWebhook(request(body), "secret", process)).status).toBe(200);
    expect(process).not.toHaveBeenCalled();
  });
  it("rejeita stream grande mesmo sem Content-Length e JSON inválido", async () => {
    const process = vi.fn();
    expect((await handleWebhook(request("x".repeat(MAX_BODY_BYTES)), "secret", process)).status).toBe(413);
    const invalid = new Request("https://app.test", { method: "POST", headers: { "x-telegram-bot-api-secret-token": "secret" }, body: "{" });
    expect((await handleWebhook(invalid, "secret", process)).status).toBe(400);
    expect(process).not.toHaveBeenCalled();
  });
  it("deduplicação/limite retorna apenas ok", async () => {
    expect(await (await handleWebhook(request(), "secret", vi.fn().mockResolvedValue(null))).json()).toEqual({ ok: true });
  });
  it.each(["/resumo", "/saldo", "/ajuda"])("falha interna em %s responde no chat com log seguro sem dados sensíveis", async (text) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("token balance chat_id user_id"), { code: "22003" });
    const body = { ...payload, message: { ...payload.message, text } };
    const result = await handleWebhook(request(body), "secret", vi.fn().mockRejectedValue(error));
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    const reply = await result.json();
    expect(reply).toEqual({
      method: "sendMessage", chat_id: 123,
      text: "⚠️ Não consegui consultar seus dados agora. Tente de novo em instantes.",
      protect_content: true,
    });
    expect(reply.text.length).toBeLessThanOrEqual(4096);
    expect(reply).not.toHaveProperty("parse_mode");
    expect(log).toHaveBeenCalledWith("[telegram-webhook]", { name: "Error", code: "22003" });
    const loggedStr = JSON.stringify(log.mock.calls);
    expect(loggedStr).not.toContain("token");
    expect(loggedStr).not.toContain("balance");
    expect(loggedStr).not.toContain("chat_id");
    expect(loggedStr).not.toContain("user_id");
    log.mockRestore();
  });
  it("resumo no limite do formatador é devolvido integralmente sem parse_mode", async () => {
    const text = "*Resumo* _com caracteres especiais_\n".padEnd(3800, "x");
    const result = await handleWebhook(request({ ...payload, message: { ...payload.message, text: "/resumo" } }), "secret", vi.fn().mockResolvedValue(text));
    const reply = await result.json();
    expect(reply.text).toBe(text);
    expect(reply.text.length).toBeLessThanOrEqual(4096);
    expect(reply).not.toHaveProperty("parse_mode");
  });
});
