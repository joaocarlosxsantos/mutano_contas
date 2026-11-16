import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), exists: vi.fn(), limit: vi.fn(), reply: vi.fn(), ai: vi.fn() }));
vi.mock("@/server/telegram/ai-service", () => ({ answerQuestion: mocks.ai }));
vi.mock("@/server/open-finance/data-age", () => ({ withOpenFinanceAge: async (_id: string, build: () => unknown) => build() }));
vi.mock("@/lib/auth", () => ({ auth: () => mocks.auth() }));
vi.mock("@/server/telegram/site-chat", () => ({ siteChatOwnerExists: (...args: unknown[]) => mocks.exists(...args),
  claimSiteChatRequest: (...args: unknown[]) => mocks.limit(...args), siteCommandReply: (...args: unknown[]) => mocks.reply(...args) }));
import { POST } from "./route";
import { CHAT_SECRET_NOTICE } from "@/lib/chat-secrets";
const request = (body: unknown = { command: "/saldo" }, headers: Record<string, string> = {}) => new Request("https://app.test/api/chat", {
  method: "POST", headers: { origin: "https://app.test", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "session-owner" } });
  mocks.exists.mockResolvedValue(true); mocks.limit.mockResolvedValue({ allowed: true }); mocks.reply.mockResolvedValue("Saldo registrado");
});
describe("Chat HTTP autenticado", () => {
  it("pergunta de ajuda usa o mesmo serviço autenticado e preserva texto/fonte sem cache", async () => {
    mocks.ai.mockResolvedValue("Abra Minha conta.\nFonte: Ajuda — Minha conta e chave de IA [minha-conta-ia:1]");
    const response = await POST(request({ message: "Onde configuro a IA do app?" }));
    expect(mocks.ai).toHaveBeenCalledWith("session-owner", "site:session-owner", "Onde configuro a IA do app?", expect.any(Date), true);
    expect((await response.json()).reply).toContain("Fonte: Ajuda");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(mocks.reply).not.toHaveBeenCalled();
  });
  it.each([`AQ.${"a".repeat(50)}`, `AIza${"a".repeat(35)}`, `sk-ant-${"a".repeat(35)}`, `sk-proj-${"a".repeat(35)}`])("segredo recebe aviso sem chamar IA nem ecoar a entrada", async token => {
    const log = vi.spyOn(console, "error");
    try {
      const response = await POST(request({ message: `qual saldo ${token}` }));
      expect(await response.json()).toEqual({ reply: CHAT_SECRET_NOTICE });
      expect(mocks.ai).not.toHaveBeenCalled(); expect(mocks.reply).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it("sanitiza segredo vindo de uma resposta de comando", async () => {
    const token = `AQ.${"a".repeat(50)}`;
    mocks.reply.mockResolvedValue(`nome: ${token}`);
    expect(await (await POST(request())).json()).toEqual({ reply: "nome: [segredo removido]" });
  });
  it("mensagem longa com segredo ainda recebe aviso, sem LLM", async () => {
    const response = await POST(request({ message: `texto ${"x".repeat(520)} AQ.${"a".repeat(50)}` }));
    expect(await response.json()).toEqual({ reply: CHAT_SECRET_NOTICE });
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it("pergunta livre usa somente a sessão e exige chave pessoal", async () => {
    mocks.ai.mockResolvedValue("Resposta financeira");
    const response = await POST(request({ message: "Quanto posso economizar este mês?" }));
    expect(await response.json()).toEqual({ reply: "Resposta financeira" });
    expect(mocks.ai).toHaveBeenCalledWith("session-owner", "site:session-owner", "Quanto posso economizar este mês?", expect.any(Date), true);
    expect(mocks.reply).not.toHaveBeenCalled();
  });
  it.each([{ message: " " }, { message: "x".repeat(513) }, { message: "saldo", userId: "victim" }, { message: "saldo", command: "/saldo" }, { message: "/desfazer" }])("rejeita perguntas inválidas %j", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.ai).not.toHaveBeenCalled();
  });
  it("exige sessão antes de acessar dados ou consumir cota", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401); expect(mocks.exists).not.toHaveBeenCalled(); expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("rejeita sessão de usuário removido", async () => {
    mocks.exists.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(401); expect(mocks.reply).not.toHaveBeenCalled();
  });
  it("usa somente o dono da sessão e não permite cache compartilhado", async () => {
    const response = await POST(request());
    expect(await response.json()).toEqual({ reply: "Saldo registrado" });
    expect(mocks.reply).toHaveBeenCalledWith("session-owner", "/saldo");
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("vary")).toBe("Cookie");
  });
  it.each([{ command: "/saldo", userId: "other" }, { command: "/saldo", chatId: "other" },
    { command: "/saldo other" }, { command: "/start secret" }, { command: "<script>alert(1)</script>" },
    { command: "meus gastos" }, { command: "/desfazer" }, { command: { $ne: null } }])("rejeita injeção/identidade/texto livre: %j", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.reply).not.toHaveBeenCalled();
  });
  it("rejeita origem externa, ausente e fetch cross-site", async () => {
    const origins: Record<string, string>[] = [{ origin: "https://evil.test" }, { origin: "" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of origins)
      expect((await POST(request(undefined, headers))).status).toBe(403);
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("rejeita tipo de conteúdo e corpo excessivo inclusive sem Content-Length", async () => {
    expect((await POST(request({}, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(request({ command: "x".repeat(9000) }))).status).toBe(400);
    expect(mocks.reply).not.toHaveBeenCalled();
  });
  it("aplica cota antes de executar, retorna Retry-After e falha fechado", async () => {
    mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 35 });
    const response = await POST(request());
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("35"); expect(mocks.reply).not.toHaveBeenCalled();
    mocks.limit.mockRejectedValue(new Error("database secret"));
    const failed = await POST(request()); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("secret");
  });
});
