import { describe, expect, it, vi } from "vitest";
import { AI_KEY_VALIDATION_TIMEOUT_MS, GEMINI_KEY_VALIDATION_TIMEOUT_MS, validateAiKey } from "./validate-key";

describe("validação remota da chave", () => {
  it.each(["claude", "openai", "gemini"] as const)("%s faz só uma chamada mínima sem chave na URL/corpo", async provider => {
    const fetch = vi.fn().mockResolvedValue(Response.json(provider === "claude" ? { content: [] } : provider === "openai" ? { choices: [] } : { models: [{ name: "models/example" }] }));
    await validateAiKey(provider, "private-secret", fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/^https:\/\//); expect(url).not.toContain("private-secret");
    expect(init.body ?? "").not.toContain("private-secret"); expect(init.redirect).toBe("error");
    expect(Object.values(init.headers).join(" ")).toContain("private-secret");
    expect(init.signal).toBeInstanceOf(AbortSignal); expect(init.cache).toBe("no-store");
    if (provider === "gemini") { expect(init.method).toBe("GET"); expect(init).not.toHaveProperty("body"); }
    else { expect(init.method).toBe("POST"); expect(JSON.parse(init.body)).not.toHaveProperty("tools"); }
  });
  it.each([[400, "invalid_api_key"], [401, "invalid_api_key"], [403, "invalid_api_key"], [402, "provider_quota"], [429, "provider_quota"], [404, "provider_model_unavailable"], [422, "provider_request_rejected"], [500, "provider_unavailable"]])("sanitiza HTTP %s", async (status, code) => {
    const fetch = vi.fn().mockResolvedValue(new Response("provider leaked key", { status: Number(status) }));
    await expect(validateAiKey("openai", "private-secret", fetch)).rejects.toMatchObject({ code, message: code, providerStatus: Number(status) });
  });
  it("rede, JSON inválido e resposta gigante não expõem detalhes", async () => {
    const log = vi.spyOn(console, "error");
    await expect(validateAiKey("claude", "private-secret", vi.fn().mockRejectedValue(new Error("private-secret")))).rejects.toMatchObject({ code: "provider_unavailable", reason: "network", providerStatus: null });
    for (const fetch of [vi.fn().mockResolvedValue(new Response("{")), vi.fn().mockResolvedValue(new Response("a".repeat(33000)))])
      await expect(validateAiKey("claude", "private-secret", fetch)).rejects.toMatchObject({ code: "provider_invalid_response", reason: "invalid_response", providerStatus: 200 });
    expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it("Gemini reconhece o erro real API_KEY_INVALID e não confunde parâmetros inválidos", async () => {
    const raw = { error: { code: 400, message: "private-secret", status: "INVALID_ARGUMENT", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID", domain: "googleapis.com" }] } };
    await expect(validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(Response.json(raw, { status: 400 })))).rejects.toMatchObject({ code: "invalid_api_key", providerStatus: 400, reason: "invalid_api_key" });
    await expect(validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(Response.json({ error: { status: "INVALID_ARGUMENT", message: "unknown thinkingLevel private-secret" } }, { status: 400 })))).rejects.toMatchObject({ code: "provider_request_rejected", providerStatus: 400, reason: "request_rejected" });
  });
  it.each(["AIzaFAKE_ONLY_NOT_A_REAL_KEY_000000000000", `AQ.${"a".repeat(50)}`])("Gemini envia tokens no header sem chave na URL e sem alterar caracteres", async apiKey => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ models: [] }));
    await validateAiKey("gemini", apiKey, fetch);
    expect(fetch.mock.calls[0][1].headers["x-goog-api-key"]).toBe(apiKey);
    expect(fetch.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1");
    expect(fetch.mock.calls[0][1].method).toBe("GET");
    expect(fetch.mock.calls[0][1]).not.toHaveProperty("body");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("Gemini aceita 200 e cancela listagem sem esperar geração ou ler corpos", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    await validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    expect(cancel).toHaveBeenCalledOnce();
    await expect(validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(new Response(null, { status: 204 })))).rejects.toMatchObject({ code: "provider_invalid_response", providerStatus: 204 });
  });
  it.each([[401, "invalid_api_key"], [403, "invalid_api_key"], [429, "provider_quota"], [500, "provider_unavailable"], [503, "provider_unavailable"], [404, "provider_request_rejected"]] as const)("Gemini classifica HTTP %s sem geração", async (status, code) => {
    await expect(validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(new Response("private-secret", { status })))).rejects.toMatchObject({ code, providerStatus: status });
  });
  it("Gemini usa timeout de 10s e distingue rede/timeout/5xx", async () => {
    expect(AI_KEY_VALIDATION_TIMEOUT_MS).toBe(15_000);
    expect(GEMINI_KEY_VALIDATION_TIMEOUT_MS).toBe(10_000);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      await validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(Response.json({ models: [] })));
      expect(timeout).toHaveBeenCalledWith(10_000);
    } finally { timeout.mockRestore(); }
    await expect(validateAiKey("gemini", "private-secret", vi.fn().mockRejectedValue(new DOMException("private-secret", "TimeoutError")))).rejects.toMatchObject({ code: "provider_unavailable", reason: "timeout", providerStatus: null });
    await expect(validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(new Response("private-secret", { status: 408 })))).rejects.toMatchObject({ code: "provider_unavailable", reason: "timeout", providerStatus: 408 });
    await expect(validateAiKey("gemini", "private-secret", vi.fn().mockResolvedValue(new Response("private-secret", { status: 503 })))).rejects.toMatchObject({ code: "provider_unavailable", reason: "upstream_error", providerStatus: 503 });
  });
});
