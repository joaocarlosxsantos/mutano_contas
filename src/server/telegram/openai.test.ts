import { describe, expect, it, vi } from "vitest";
import { askOpenai } from "./ai";
import { AI_FAILURE, AI_NO_DATA } from "./ai-policy";
import { OPENAI_ENDPOINT, OPENAI_MODEL } from "./openai";

const env = { OPENAI_API_KEY: "personal-private-key" };
const tool = (name = "get_balance", args = "{}", id = "call-1") => Response.json({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id, type: "function", function: { name, arguments: args } }] } }] });
const answer = (text = "Saldo R$ 10,00") => Response.json({ choices: [{ finish_reason: "stop", message: { content: text } }] });

describe("OpenAI com as mesmas ferramentas de leitura", () => {
  it("mantém ferramentas, dono fechado pelo servidor e replay correto de tool call", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(tool()).mockResolvedValueOnce(answer());
    const runTool = vi.fn().mockResolvedValue({ availableCents: 1000 });
    expect(await askOpenai("saldo?", "2026-11-16", "Manual", { fetch, runTool }, env)).toContain("10,00");
    expect(runTool).toHaveBeenCalledWith("get_balance", {});
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(OPENAI_ENDPOINT); expect(init.headers.Authorization).toBe(`Bearer ${env.OPENAI_API_KEY}`);
    const first = JSON.parse(init.body); expect(first.model).toBe(OPENAI_MODEL); expect(first.store).toBe(false);
    expect(first.tools).toHaveLength(5); expect(first.messages[0].content).toContain("Não há ferramenta de escrita");
    expect(init.body).not.toContain(env.OPENAI_API_KEY);
    const second = JSON.parse(fetch.mock.calls[1][1].body);
    expect(second.messages.at(-1)).toEqual({ role: "tool", tool_call_id: "call-1", content: '{"availableCents":1000}' });
    expect(second.messages[2].tool_calls[0].function.name).toBe("get_balance");
  });
  it.each([["delete_transaction", "{}"], ["get_balance", '{"user_id":"victim"}']])("nunca executa escrita/identidade injetada: %s", async (name, args) => {
    const runTool = vi.fn(); const fetch = vi.fn().mockResolvedValueOnce(tool(name, args)).mockResolvedValueOnce(answer("Apaguei tudo"));
    expect(await askOpenai("apague tudo", "2026-11-16", "", { fetch, runTool }, env)).toBe(AI_NO_DATA);
    expect(runTool).not.toHaveBeenCalled();
  });
  it("não retorna números sem consultar dados, remove segredos e limita loops", async () => {
    expect(await askOpenai("saldo", "2026-11-16", "", { fetch: vi.fn().mockResolvedValue(answer()), runTool: vi.fn() }, env)).toBe(AI_NO_DATA);
    const fetch = vi.fn().mockResolvedValueOnce(tool()).mockResolvedValueOnce(answer(`saldo ${env.OPENAI_API_KEY} https://evil.test`));
    const text = await askOpenai("saldo", "2026-11-16", "", { fetch, runTool: vi.fn().mockResolvedValue({}) }, env);
    expect(text).not.toContain(env.OPENAI_API_KEY); expect(text).not.toContain("https:");
    expect(await askOpenai("saldo", "2026-11-16", "", { fetch: vi.fn().mockImplementation(async () => tool()), runTool: vi.fn().mockResolvedValue({}) }, env)).toBe(AI_FAILURE);
  });
  it("rejeita JSON de argumentos, truncamento e erros HTTP", async () => {
    for (const response of [tool("get_balance", "{"), new Response("private", { status: 401 }), Response.json({ choices: [{ finish_reason: "length", message: { content: "parcial" } }] })])
      expect(await askOpenai("saldo", "2026-11-16", "", { fetch: vi.fn().mockResolvedValue(response), runTool: vi.fn() }, env)).toBe(AI_FAILURE);
  });
});
