import { AI_MODEL } from "@/server/telegram/ai-policy";
import { GEMINI_ENDPOINT } from "@/server/telegram/gemini";
import { OPENAI_ENDPOINT, OPENAI_MODEL } from "@/server/telegram/openai";
import { limitedAiJson } from "@/server/telegram/ai";
import type { UserAiProvider } from "./credentials-schema";

export class AiKeyValidationError extends Error {
  constructor(public readonly code: "invalid_api_key" | "provider_quota" | "provider_unavailable") { super(code); }
}

/** Uma única geração curta, sem pergunta nem dados financeiros do usuário. */
export async function validateAiKey(provider: UserAiProvider, apiKey: string, fetcher: typeof fetch = fetch) {
  const url = provider === "claude" ? "https://api.anthropic.com/v1/messages" : provider === "openai" ? OPENAI_ENDPOINT : GEMINI_ENDPOINT;
  const body = provider === "claude" ? { model: AI_MODEL, max_tokens: 8, thinking: { type: "disabled" }, messages: [{ role: "user", content: "Reply OK" }] }
    : provider === "openai" ? { model: OPENAI_MODEL, max_completion_tokens: 8, store: false, messages: [{ role: "user", content: "Reply OK" }] }
    : { contents: [{ role: "user", parts: [{ text: "Reply OK" }] }], generationConfig: { maxOutputTokens: 8, thinkingConfig: { thinkingLevel: "LOW", includeThoughts: false } } };
  try {
    const response = await fetcher(url, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: provider === "gemini" ? { "Content-Type": "application/json", "x-goog-api-key": apiKey }
        : { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(provider === "claude" ? { "anthropic-version": "2026-10-21" } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if ([400, 401, 403].includes(response.status)) throw new AiKeyValidationError("invalid_api_key");
      if ([402, 429].includes(response.status)) throw new AiKeyValidationError("provider_quota");
      throw new AiKeyValidationError("provider_unavailable");
    }
    // A resposta é consumida com limite; seu conteúdo nunca é registrado ou retornado.
    const result = await limitedAiJson(response);
    if (!result || typeof result !== "object" || !(provider === "claude" ? "content" in result : provider === "openai" ? "choices" in result : "candidates" in result))
      throw new AiKeyValidationError("provider_unavailable");
  } catch (error) {
    if (error instanceof AiKeyValidationError) throw error;
    throw new AiKeyValidationError("provider_unavailable");
  }
}
