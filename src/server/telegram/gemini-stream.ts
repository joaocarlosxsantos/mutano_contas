import { AI_MAX_RESPONSE_BYTES } from "./ai-policy";

/** SSE é montado somente em memória, com limite total e cancelamento do reader. */
export async function readGeminiStream(response: Response, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_stream");
  const decoder = new TextDecoder();
  const parts: Record<string, unknown>[] = [];
  let buffer = "";
  let size = 0;
  let frames = 0;
  let finishReason: string | undefined;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  function event(value: string) {
    const data = value.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") return;
    if (++frames > 256) throw new Error("stream_frame_limit");
    const raw: unknown = JSON.parse(data);
    if (!raw || typeof raw !== "object" || !("candidates" in raw) || !Array.isArray(raw.candidates)) throw new Error("invalid_stream");
    if (raw.candidates.length !== 1) throw new Error("invalid_stream");
    const candidate = raw.candidates[0] as { index?: unknown; finishReason?: unknown; content?: { parts?: unknown } };
    if (candidate.index !== undefined && candidate.index !== 0) throw new Error("invalid_stream");
    if (typeof candidate.finishReason === "string") finishReason = candidate.finishReason;
    if (!candidate.content?.parts) return;
    if (!Array.isArray(candidate.content.parts)) throw new Error("invalid_stream");
    for (const value of candidate.content.parts) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_stream");
      const part = value as Record<string, unknown>;
      const previous = parts.at(-1);
      // Só combinar deltas textuais sem assinatura; funções e metadados ficam intactos.
      if (typeof part.text === "string" && previous && typeof previous.text === "string"
        && !part.thoughtSignature && !previous.thoughtSignature && !part.functionCall && !previous.functionCall
        && part.thought === previous.thought) previous.text += part.text;
      else parts.push({ ...part });
      if (parts.length > 8) throw new Error("stream_part_limit");
    }
  }
  try {
    signal.throwIfAborted();
    while (!finishReason) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) {
        buffer += decoder.decode();
        if (buffer.trim()) event(buffer);
        break;
      }
      size += chunk.value.byteLength;
      if (size > AI_MAX_RESPONSE_BYTES) throw new Error("response_too_large");
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        event(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (finishReason) break;
      }
    }
    if (!finishReason || !parts.length) throw new Error("incomplete_stream");
    return { candidates: [{ finishReason, content: { role: "model", parts } }] };
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
