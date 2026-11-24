import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sync: vi.fn(), findConnection: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./crypto", () => ({ secretFingerprint: (value: string) => `hash:${value}` }));
vi.mock("./sync", () => ({ syncOpenFinanceForUser: mocks.sync }));
vi.mock("@/server/notifications/dispatcher", () => ({ notificationDispatcher: { dispatch: mocks.dispatch } }));

import { handlePluggyWebhook } from "./webhook";

const secret = "pluggy-secret";
const scheduled: Array<() => Promise<void>> = [];
const deps = { findConnection: mocks.findConnection, schedule: (task: () => Promise<void>) => { scheduled.push(task); } };
const request = (body: unknown, headers: Record<string, string> = { "x-webhook-secret": secret }) =>
  new Request("https://app.test/api/open-finance/webhook", { method: "POST", headers, body: JSON.stringify(body) });
const updated = (eventId: string, itemId = "item-1", clientUserId = "owner-1") => ({
  event: "item/updated", eventId, itemId, clientUserId, clientId: "client-app", triggeredBy: "SYNC",
});

afterEach(() => { vi.clearAllMocks(); scheduled.length = 0; });

describe("webhook Pluggy item/updated", () => {
  it("sem segredo configurado responde 503", async () => {
    const response = await handlePluggyWebhook(request(updated("e-503")), undefined, deps);
    expect(response.status).toBe(503);
    expect(mocks.findConnection).not.toHaveBeenCalled();
  });

  it("rejeita segredo errado/ausente sem consultar a conexão", async () => {
    expect((await handlePluggyWebhook(request(updated("e-401"), { "x-webhook-secret": "wrong" }), secret, deps)).status).toBe(401);
    expect((await handlePluggyWebhook(request(updated("e-401b"), {}), secret, deps)).status).toBe(401);
    expect(mocks.findConnection).not.toHaveBeenCalled();
  });

  it("autentica, localiza a conexão e agenda o sync depois do ACK", async () => {
    mocks.findConnection.mockResolvedValue({ id: "conn-1", userId: "owner-1" });
    mocks.sync.mockResolvedValue({ ok: true, status: "UPDATED", imported: 3, accounts: [{ inserted: 3 }] });
    mocks.dispatch.mockResolvedValue({});
    const response = await handlePluggyWebhook(request(updated("e-202", "private-item", "owner-1")), secret, deps);
    expect(response.status).toBe(202);
    expect(mocks.findConnection).toHaveBeenCalledWith("private-item", "owner-1");
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    await scheduled[0]!();
    expect(mocks.sync).toHaveBeenCalledWith("owner-1", "conn-1", "webhook");
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner-1", category: "syncAlerts", type: "pluggy_sync_updated" }));
  });

  it("ignora eventos que não sejam item/updated e item desconhecido", async () => {
    const ignored = await handlePluggyWebhook(request({ event: "item/error", eventId: "e-error", itemId: "item-1" }), secret, deps);
    expect(ignored.status).toBe(200);
    expect(mocks.findConnection).not.toHaveBeenCalled();
    mocks.findConnection.mockResolvedValue(null);
    const unknown = await handlePluggyWebhook(request(updated("e-unknown", "outro-item")), secret, deps);
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toMatchObject({ ignored: true });
    expect(scheduled).toHaveLength(0);
  });

  it("payload inválido responde 400 e corpo grande responde 413", async () => {
    expect((await handlePluggyWebhook(request({ event: "item/updated" }), secret, deps)).status).toBe(400);
    expect((await handlePluggyWebhook(request({ event: "item/updated", itemId: "item-1", eventId: 1 }), secret, deps)).status).toBe(400);
    const huge = new Request("https://app.test/api/open-finance/webhook", {
      method: "POST", headers: { "x-webhook-secret": secret, "content-length": String(20_000) }, body: "{}",
    });
    expect((await handlePluggyWebhook(huge, secret, deps)).status).toBe(413);
  });

  it("deduplica eventId e devolve 500 se o lookup falhar", async () => {
    mocks.findConnection.mockResolvedValue({ id: "conn-1", userId: "owner-1" });
    expect((await handlePluggyWebhook(request(updated("e-dup")), secret, deps)).status).toBe(202);
    mocks.sync.mockResolvedValue({ ok: true, status: "UPDATED", imported: 0, accounts: [] });
    await scheduled[0]!();
    const duplicate = await handlePluggyWebhook(request(updated("e-dup")), secret, deps);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ duplicate: true });
    expect(scheduled).toHaveLength(1);

    mocks.findConnection.mockRejectedValue(new Error("db down"));
    const failure = await handlePluggyWebhook(request(updated("e-db")), secret, deps);
    expect(failure.status).toBe(500);
  });
});

describe("webhook Pluggy: segredo na URL, eventos e dedupe estável", () => {
  const urlRequest = (body: unknown, query: string) =>
    new Request(`https://app.test/api/open-finance/webhook${query}`, { method: "POST", headers: {}, body: JSON.stringify(body) });

  it("aceita ?secret= quando o header não existe (painel Pluggy) e rejeita ?secret= errado", async () => {
    mocks.findConnection.mockResolvedValue({ id: "conn-q", userId: "owner-1" });
    expect((await handlePluggyWebhook(urlRequest(updated("e-q1"), `?secret=${secret}`), secret, deps)).status).toBe(202);
    expect((await handlePluggyWebhook(urlRequest(updated("e-q2"), "?secret=nope"), secret, deps)).status).toBe(401);
    expect((await handlePluggyWebhook(urlRequest(updated("e-q3"), ""), secret, deps)).status).toBe(401);
  });

  it("header com segredo errado não é salvo pelo ?secret= correto", async () => {
    const response = await handlePluggyWebhook(
      new Request(`https://app.test/api/open-finance/webhook?secret=${secret}`, { method: "POST", headers: { "x-webhook-secret": "wrong" }, body: JSON.stringify(updated("e-h")) }),
      secret,
      deps,
    );
    expect(response.status).toBe(401);
  });

  it("aceita transactions/created e ignora outros eventos", async () => {
    mocks.findConnection.mockResolvedValue({ id: "conn-t", userId: "owner-1" });
    const created = await handlePluggyWebhook(request({ event: "transactions/created", eventId: "e-tx", itemId: "item-1" }), secret, deps);
    expect(created.status).toBe(202);
    expect(scheduled).toHaveLength(1);
    mocks.sync.mockResolvedValue({ ok: true, status: "UPDATED", imported: 0 });
    await scheduled[0]!();
    expect(mocks.sync).toHaveBeenCalledWith("owner-1", "conn-t", "webhook");
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining("Sem transações novas") }));
    mocks.dispatch.mockClear();
    mocks.sync.mockResolvedValue({ ok: true, status: "UPDATED", imported: 0, error: "parcial" });
    await scheduled[0]!();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    const other = await handlePluggyWebhook(request({ event: "item/login_succeeded", eventId: "e-ls", itemId: "item-1" }), secret, deps);
    expect(await other.json()).toMatchObject({ ignored: true });
  });

  it("chave de dedupe é estável: mesmo evento repetido não reagenda, e a notificação não usa Date.now", async () => {
    mocks.findConnection.mockResolvedValue({ id: "conn-s", userId: "owner-1" });
    mocks.sync.mockResolvedValue({ ok: true, status: "UPDATED", imported: 1, accounts: [{ inserted: 1 }] });
    mocks.dispatch.mockResolvedValue({});
    expect((await handlePluggyWebhook(request(updated("e-stable")), secret, deps)).status).toBe(202);
    await scheduled[0]!();
    expect((await handlePluggyWebhook(request(updated("e-stable")), secret, deps)).status).toBe(200);
    expect(scheduled).toHaveLength(1);
    const dedupeKey = mocks.dispatch.mock.calls[0]?.[0]?.dedupeKey as string;
    expect(dedupeKey).toMatch(/^pluggy_sync_[0-9a-f]{40}$/);
  });

  it("webhookEventKey: eventId diferente gera chave diferente; sem eventId usa hash do corpo", async () => {
    const { webhookEventKey } = await import("./webhook");
    expect(webhookEventKey("item/updated", "i", "a", "x")).not.toBe(webhookEventKey("item/updated", "i", "b", "x"));
    expect(webhookEventKey("item/updated", "i", undefined, "x")).toBe(webhookEventKey("item/updated", "i", undefined, "x"));
    expect(webhookEventKey("item/updated", "i", undefined, "x")).not.toBe(webhookEventKey("item/updated", "i", undefined, "y"));
  });
});

 describe("retentativas e contagem de insercoes", () => {
  it.each(["throw", "error", "skipped"])("preserva evento apos %s", async failure => {
    mocks.findConnection.mockResolvedValue({ id: "conn-retry", userId: "owner-1" });
    const wait = vi.fn().mockResolvedValue(undefined);
    if (failure === "throw") mocks.sync.mockRejectedValueOnce(new Error("offline"));
    else mocks.sync.mockResolvedValue(failure === "skipped" ? { skipped: true } : { error: "partial" });
    const body = updated(`retry-${failure}`);
    await handlePluggyWebhook(request(body), secret, { ...deps, wait });
    await scheduled[0]!();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    if (failure === "skipped") { expect(wait).toHaveBeenCalledWith(5_000); expect(mocks.sync).toHaveBeenCalledTimes(2); }
    expect((await handlePluggyWebhook(request(body), secret, { ...deps, wait })).status).toBe(202);
  });
  it("retry curto conclui e conta apenas insercoes", async () => {
    mocks.findConnection.mockResolvedValue({ id: "conn-retry-ok", userId: "owner-1" });
    mocks.sync.mockResolvedValueOnce({ skipped: true }).mockResolvedValueOnce({ ok: true, status: "UPDATED", imported: 9, accounts: [{ inserted: 2, updated: 7 }] });
    const wait = vi.fn().mockResolvedValue(undefined);
    const body = updated("retry-ok");
    await handlePluggyWebhook(request(body), secret, { ...deps, wait });
    await scheduled[0]!();
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining("2 novas") }));
    expect((await handlePluggyWebhook(request(body), secret, deps)).status).toBe(200);
  });
  it("atualizacoes sem insercoes usam mensagem e dedupe diarios", async () => {
    mocks.findConnection.mockResolvedValue({ id: "conn-updates", userId: "owner-1" });
    mocks.sync.mockResolvedValue({ ok: true, status: "UPDATED", imported: 9, accounts: [{ inserted: 0, updated: 9 }] });
    await handlePluggyWebhook(request(updated("only-updates")), secret, deps);
    await scheduled[0]!();
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ body: "Dados atualizados pelo banco. Sem transacoes novas.".replace("transacoes", "transa\u00e7\u00f5es"), dedupeKey: expect.stringMatching(/^pluggy_sync_idle_conn-updates_/) }));
  });
});

 describe("falha isolada de notificacao", () => {
  it("loga notify_failed e deduplica evento sem repetir sync concluido", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.findConnection.mockResolvedValue({ id: "conn-notify-failure", userId: "owner-1" });
      mocks.sync.mockResolvedValue({ ok: true, status: "UPDATED", imported: 1, accounts: [{ inserted: 1 }] });
      mocks.dispatch.mockRejectedValueOnce(new Error("offline"));
      const body = updated("notify-failure-event");
      await handlePluggyWebhook(request(body), secret, deps);
      await expect(scheduled[0]!()).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith("[pluggy-webhook]", expect.objectContaining({ status: "notify_failed" }));
      expect(log).not.toHaveBeenCalledWith("[pluggy-webhook]", expect.objectContaining({ status: "sync_failed" }));
      const retry = await handlePluggyWebhook(request(body), secret, deps);
      expect(await retry.json()).toMatchObject({ duplicate: true });
      expect(mocks.sync).toHaveBeenCalledTimes(1);
      expect(scheduled).toHaveLength(1);
    } finally { log.mockRestore(); }
  });
});

 describe("logs seguros dos desfechos", () => {
  it("registra rejeicoes, recebimento e eventos ignorados sem dados sensiveis", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const privateItem = "private-item-not-for-logs";
    const privateBody = "private-body-not-for-logs";
    const wrongSecret = "wrong-secret-not-for-logs";
    const makeRequest = (body: string, headers: Record<string, string>, query = "") => new Request(`https://app.test/api/open-finance/webhook${query}`, { method: "POST", headers, body });
    try {
      await handlePluggyWebhook(request(updated("log-unavailable")), undefined, deps);
      expect(warn).toHaveBeenCalledWith("[pluggy-webhook]", { status: "unavailable", httpStatus: 503 });
      for (const [headerSecretPresent, querySecretPresent] of [[true, false], [false, true], [true, true], [false, false]]) {
        const headers: Record<string, string> = headerSecretPresent ? { "x-webhook-secret": wrongSecret } : {};
        const query = querySecretPresent ? `?secret=${wrongSecret}` : "";
        const response = await handlePluggyWebhook(makeRequest(privateBody, headers, query), secret, deps);
        expect(response.status).toBe(401);
        expect(warn).toHaveBeenLastCalledWith("[pluggy-webhook]", { status: "unauthorized", headerSecretPresent, querySecretPresent });
      }
      const auth = { "x-webhook-secret": secret };
      for (const body of [privateBody, JSON.stringify({ event: 42, itemId: privateItem }), JSON.stringify({ event: "item/updated" })]) {
        expect((await handlePluggyWebhook(makeRequest(body, auth), secret, deps)).status).toBe(400);
        expect(warn).toHaveBeenLastCalledWith("[pluggy-webhook]", { status: "invalid_request", httpStatus: 400 });
      }
      expect((await handlePluggyWebhook(makeRequest(privateBody, { ...auth, "content-length": "20000" }), secret, deps)).status).toBe(413);
      expect(warn).toHaveBeenLastCalledWith("[pluggy-webhook]", { status: "invalid_request", httpStatus: 413 });
      await handlePluggyWebhook(request({ event: "item/error", eventId: "123456789012-private-tail", itemId: privateItem, extra: privateBody }), secret, deps);
      expect(info).toHaveBeenCalledWith("[pluggy-webhook]", { status: "received", event: "item/error", eventId: "123456789012" });
      expect(info).toHaveBeenCalledWith("[pluggy-webhook]", { status: "ignored", event: "item/error" });
      mocks.findConnection.mockResolvedValue(null);
      await handlePluggyWebhook(request(updated("received-ok-event", privateItem)), secret, deps);
      expect(info).toHaveBeenCalledWith("[pluggy-webhook]", { status: "received", event: "item/updated", eventId: "received-ok-" });
      const logs = JSON.stringify([...info.mock.calls, ...warn.mock.calls, ...error.mock.calls]);
      for (const value of [secret, wrongSecret, privateItem, privateBody, "private-tail"]) expect(logs).not.toContain(value);
    } finally { info.mockRestore(); warn.mockRestore(); error.mockRestore(); }
  });
});
