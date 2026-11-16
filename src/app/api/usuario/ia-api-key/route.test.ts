import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), owner: vi.fn(), limit: vi.fn(), status: vi.fn(), save: vi.fn(), remove: vi.fn(), validate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/telegram/site-chat", () => ({ siteChatOwnerExists: mocks.owner }));
vi.mock("@/server/ai/credentials-store", () => ({ claimAiCredentialRequest: mocks.limit, getAiCredentialStatus: mocks.status, saveAiCredential: mocks.save, removeAiCredential: mocks.remove }));
vi.mock("@/server/ai/validate-key", async importOriginal => ({ ...await importOriginal<typeof import("@/server/ai/validate-key")>(), validateAiKey: mocks.validate }));
import { GET, PUT, DELETE } from "./route";
import { AiKeyValidationError } from "@/server/ai/validate-key";

const empty = { configured: false, provider: null, last4: null };
const apiKey = `sk-proj-${"a".repeat(40)}1234`;
const request = (method: string, body?: unknown, headers = {}) => new Request("https://app.test/api/usuario/ia-api-key", {
  method, headers: { origin: "https://app.test", "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "owner" } }); mocks.owner.mockResolvedValue(true);
  mocks.limit.mockResolvedValue({ allowed: true }); mocks.status.mockResolvedValue(empty); mocks.remove.mockResolvedValue(empty);
  mocks.save.mockResolvedValue({ configured: true, provider: "openai", last4: "1234" });
});

describe("API BYOK autenticada", () => {
  it("salva só após validar e fornece status seguro; remoção idempotente", async () => {
    const response = await PUT(request("PUT", { provider: "openai", apiKey }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: true, provider: "openai", last4: "1234" });
    expect(mocks.validate).toHaveBeenCalledWith("openai", apiKey);
    expect(mocks.save).toHaveBeenCalledWith("owner", "openai", apiKey);
    expect(mocks.validate.mock.invocationCallOrder[0]).toBeLessThan(mocks.save.mock.invocationCallOrder[0]);
    expect(await (await DELETE(request("DELETE"))).json()).toEqual(empty);
    expect(mocks.remove).toHaveBeenCalledWith("owner");
    const get = await GET(request("GET")); expect(await get.json()).toEqual(empty);
    expect(get.headers.get("cache-control")).toContain("no-store"); expect(get.headers.get("vary")).toBe("Cookie");
  });
  it.each([GET, PUT, DELETE])("exige sessão e dono ainda existente antes de acessar configuração", async handler => {
    mocks.auth.mockResolvedValue(null); expect((await handler(request("GET"))).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { id: "owner" } }); mocks.owner.mockResolvedValue(false);
    expect((await handler(request("GET"))).status).toBe(401);
    expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it.each([PUT, DELETE])("bloqueia mutação por origem ausente/externa/cross-site", async handler => {
    for (const headers of [{ origin: "" }, { origin: "https://evil.test" }, { "sec-fetch-site": "cross-site" }])
      expect((await handler(request("DELETE", undefined, headers))).status).toBe(403);
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it.each([GET, PUT, DELETE])("limita tentativas antes de acessar ou validar chave", async handler => {
    mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await handler(request("GET")); expect(res.status).toBe(429); expect(res.headers.get("retry-after")).toBe("60");
    expect(mocks.validate).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it.each([{ provider: "evil", apiKey }, { provider: "openai", apiKey, userId: "victim" }, { provider: "gemini", apiKey }, { provider: "openai", apiKey: "x".repeat(9000) }])("rejeita entrada sem ecoar segredo", async body => {
    const res = await PUT(request("PUT", body)); expect(res.status).toBe(400); expect(await res.text()).not.toContain(apiKey);
    expect(mocks.validate).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejeita JSON malformado e conteúdo não JSON", async () => {
    expect((await PUT(request("PUT", {}, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await PUT(new Request("https://app.test/api/usuario/ia-api-key", { method: "PUT", headers: { origin: "https://app.test", "content-type": "application/json" }, body: "{" }))).status).toBe(400);
  });
  it.each([["invalid_api_key", 422], ["provider_quota", 422], ["provider_unavailable", 503]] as const)("não altera chave anterior se validação retorna %s", async (code, status) => {
    mocks.validate.mockRejectedValue(new AiKeyValidationError(code));
    const response = await PUT(request("PUT", { provider: "openai", apiKey }));
    expect(response.status).toBe(status); expect((await response.json()).code).toBe(code); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("falha de criptografia/banco não loga nem devolve exceções sensíveis", async () => {
    mocks.save.mockRejectedValue(new Error(apiKey)); const log = vi.spyOn(console, "error");
    const response = await PUT(request("PUT", { provider: "openai", apiKey }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(apiKey); expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
});
