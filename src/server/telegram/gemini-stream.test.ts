import { describe, expect, it, vi } from "vitest";
import { readGeminiStream } from "./gemini-stream";

const frame = (parts: unknown[], finishReason?: string) => `data: ${JSON.stringify({ candidates: [{ index: 0, content: { role: "model", parts }, ...(finishReason ? { finishReason } : {}) }] })}\r\n\r\n`;
const stream = (pieces: string[], cancel = vi.fn()) => new Response(new ReadableStream({ start(controller) { for (const piece of pieces) controller.enqueue(new TextEncoder().encode(piece)); controller.close(); }, cancel }), { headers: { "Content-Type": "text/event-stream" } });

describe("stream Gemini limitado e cancelável", () => {
  it("remonta eventos/textos divididos e encerra ao finishReason sem esperar EOF", async () => {
    const cancel = vi.fn();
    const body = frame([{ text: "Olá " }]) + frame([{ text: "mundo" }], "STOP");
    const result = await readGeminiStream(new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); }, cancel })), new AbortController().signal);
    expect(result).toEqual({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: "Olá mundo" }] } }] });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("preserva funções/assinaturas opacas em eventos separados e UTF8 fragmentado", async () => {
    const parts = [{ functionCall: { name: "get_balance", args: {} }, thoughtSignature: "opaque-signature" }];
    const data = frame(parts, "STOP");
    expect(await readGeminiStream(stream([data.slice(0, 10), data.slice(10)]), new AbortController().signal)).toEqual({ candidates: [{ finishReason: "STOP", content: { role: "model", parts } }] });
  });
  it("aborta reader pendente com o sinal recebido, sem manter conexão viva", async () => {
    const controller = new AbortController(); const cancel = vi.fn();
    const pending = readGeminiStream(new Response(new ReadableStream({ cancel })), controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow(); expect(cancel).toHaveBeenCalled();
  });
  it.each(["data: {\n\n", frame([{ text: "parcial" }]), "data: " + "x".repeat(33000)])("falha fechado em stream malformado/incompleto/excessivo", async value => {
    await expect(readGeminiStream(stream([value]), new AbortController().signal)).rejects.toThrow();
  });
});
