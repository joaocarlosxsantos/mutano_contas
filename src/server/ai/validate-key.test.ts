import { describe, expect, it, vi } from "vitest";
import { validateAiKey } from "./validate-key";

describe("validação remota da chave", () => {
  it.each(["claude", "openai", "gemini"] as const)("%s faz só uma chamada mínima sem chave na URL/corpo", async provider => {
    const fetch = vi.fn().mockResolvedValue(Response.json(provider === "claude" ? { content: [] } : provider === "openai" ? { choices: [] } : { candidates: [] }));
    await validateAiKey(provider, "private-secret", fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/^https:\/\//); expect(url).not.toContain("private-secret");
    expect(init.body).not.toContain("private-secret"); expect(init.redirect).toBe("error");
    expect(Object.values(init.headers).join(" ")).toContain("private-secret");
    expect(init.signal).toBeInstanceOf(AbortSignal); expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body)).not.toHaveProperty("tools");
  });
  it.each([[400, "invalid_api_key"], [401, "invalid_api_key"], [403, "invalid_api_key"], [402, "provider_quota"], [429, "provider_quota"], [500, "provider_unavailable"]])("sanitiza HTTP %s", async (status, code) => {
    const fetch = vi.fn().mockResolvedValue(new Response("provider leaked key", { status: Number(status) }));
    await expect(validateAiKey("openai", "private-secret", fetch)).rejects.toMatchObject({ code, message: code });
  });
  it("rede, JSON inválido e resposta gigante não expõem detalhes", async () => {
    const log = vi.spyOn(console, "error");
    for (const fetch of [vi.fn().mockRejectedValue(new Error("private-secret")), vi.fn().mockResolvedValue(new Response("{")), vi.fn().mockResolvedValue(new Response("a".repeat(33000)))])
      await expect(validateAiKey("claude", "private-secret", fetch)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
});
