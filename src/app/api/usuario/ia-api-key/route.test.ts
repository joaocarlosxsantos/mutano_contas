import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.limit.mockResolvedValue({ allowed: true }); mocks.status.mockResolvedValue(empty); mocks.remove.mockResolvedValue(empty);
  mocks.save.mockResolvedValue({ configured: true, provider: "openai", last4: "1234" });
});
afterEach(() => vi.restoreAllMocks());

describe("API BYOK autenticada", () => {
  it.each([`AQ.${"a".repeat(50)}`, `AQ.${"aB3_-.~+/=".repeat(5)}`, `AIza${"aB3_-".repeat(7)}`, `AIza${"a".repeat(36)}`, `new-google-prefix_${"a".repeat(30)}`])("normaliza chave Gemini colada e valida remotamente antes de salvar", async apiKey => {
    mocks.save.mockResolvedValue({ configured: true, provider: "gemini", last4: apiKey.slice(-4) });
    const response = await PUT(request("PUT", { provider: "gemini", apiKey: ` \r\n\t${apiKey}\r\n ` }));
    expect(response.status).toBe(200);
    expect(mocks.validate).toHaveBeenCalledWith("gemini", apiKey);
    expect(mocks.save).toHaveBeenCalledWith("owner", "gemini", apiKey);
    expect(mocks.validate.mock.invocationCallOrder[0]).toBeLessThan(mocks.save.mock.invocationCallOrder[0]);
    expect(await response.json()).toEqual({ configured: true, provider: "gemini", last4: apiKey.slice(-4) });
  });
  it("formato Gemini plausível ainda precisa ser aceito pelo provedor", async () => {
    mocks.validate.mockRejectedValue(new AiKeyValidationError("invalid_api_key"));
    const response = await PUT(request("PUT", { provider: "gemini", apiKey: `future-prefix_${"a".repeat(30)}` }));
    expect(response.status).toBe(422); expect((await response.json()).code).toBe("invalid_api_key");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([
    [{ provider: "unknown-private-value", apiKey }, "O campo provider é inválido. Use claude, openai ou gemini."],
    [{ provider: "gemini", apiKey: "a".repeat(19) }, "O campo apiKey deve ter entre 20 e 256 caracteres."],
    [{ provider: "gemini", apiKey: "a".repeat(257) }, "O campo apiKey deve ter entre 20 e 256 caracteres."],
    [{ provider: "gemini", apiKey: 123 }, "O campo apiKey deve ser uma chave em texto."],
    [{ provider: "gemini", apiKey: `AQ.${"a".repeat(30)}\nprivate-value` }, "Formato do campo apiKey inválido para o provedor selecionado. Cole a chave sem espaços ou quebras de linha internas."],
    [{ provider: "claude", apiKey: `AQ.${"a".repeat(50)}` }, "Formato do campo apiKey inválido para o provedor selecionado. Cole a chave sem espaços ou quebras de linha internas."],
    [{ provider: "gemini", apiKey, "unexpected-private-field": true }, "Envie somente os campos provider e apiKey."],
  ])("identifica campo/tamanho/formato sem expor entrada", async (body, message) => {
    const log = vi.spyOn(console, "error");
    try {
      const response = await PUT(request("PUT", body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: "invalid_input", error: message });
      expect(mocks.validate).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
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
  it.each([{ provider: "evil", apiKey }, { provider: "openai", apiKey, userId: "victim" }, { provider: "gemini", apiKey, extra: "unexpected" }, { provider: "gemini", apiKey: "AIza invalid key with spaces" }, { provider: "openai", apiKey: "x".repeat(9000) }])("rejeita entrada sem ecoar segredo", async body => {
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
  it.each([
    [new AiKeyValidationError("invalid_api_key", 400), 422, "Chave rejeitada"],
    [new AiKeyValidationError("provider_quota", 429), 422, "limite de uso"],
    [new AiKeyValidationError("provider_model_unavailable", 404), 502, "modelo de IA"],
    [new AiKeyValidationError("provider_request_rejected", 400), 502, "parâmetros"],
    [new AiKeyValidationError("provider_invalid_response", 200), 502, "resposta inválida"],
    [new AiKeyValidationError("provider_unavailable", null, "timeout"), 503, "15 segundos"],
    [new AiKeyValidationError("provider_unavailable", null, "network"), 503, "conectar"],
    [new AiKeyValidationError("provider_unavailable", 503), 503, "temporariamente indisponível"],
  ] as const)("expõe somente diagnóstico seguro e loga só status/code", async (error, status, message) => {
    mocks.validate.mockRejectedValue(error);
    const response = await PUT(request("PUT", { provider: "gemini", apiKey: `AQ.${"a".repeat(50)}` }));
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).toEqual({ code: error.code, error: expect.stringContaining(message), providerStatus: error.providerStatus, reason: error.reason });
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("[ai-key-validation]", { status: error.providerStatus, code: error.code });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("falha de criptografia/banco não loga nem devolve exceções sensíveis", async () => {
    mocks.save.mockRejectedValue(new Error(apiKey)); const log = vi.spyOn(console, "error");
    const response = await PUT(request("PUT", { provider: "openai", apiKey }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(apiKey); expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
});
