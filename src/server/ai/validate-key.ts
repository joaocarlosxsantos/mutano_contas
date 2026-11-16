import { AI_MODEL } from "@/server/telegram/ai-policy";
import { GEMINI_ENDPOINT } from "@/server/telegram/gemini";
import { OPENAI_ENDPOINT, OPENAI_MODEL } from "@/server/telegram/openai";
import { limitedAiJson } from "@/server/telegram/ai";
import type { UserAiProvider } from "./credentials-schema";

export type AiKeyErrorCode = "invalid_api_key" | "provider_quota" | "provider_model_unavailable" | "provider_request_rejected" | "provider_invalid_response" | "provider_unavailable";
type AiKeyErrorReason = "invalid_api_key" | "quota" | "model_unavailable" | "request_rejected" | "invalid_response" | "upstream_error" | "timeout" | "network";
const defaultReasons: Record<AiKeyErrorCode, AiKeyErrorReason> = {
  invalid_api_key: "invalid_api_key", provider_quota: "quota", provider_model_unavailable: "model_unavailable",
  provider_request_rejected: "request_rejected", provider_invalid_response: "invalid_response", provider_unavailable: "upstream_error",
};
export const AI_KEY_VALIDATION_TIMEOUT_MS = 15_000;

export class AiKeyValidationError extends Error {
  constructor(public readonly code: AiKeyErrorCode, public readonly providerStatus: number | null = null,
    public readonly reason: AiKeyErrorReason = defaultReasons[code]) { super(code); }
}

/** Examina somente códigos estruturados; nunca repassa mensagens do Google. */
function googleInvalidKey(raw: unknown) {
  if (!raw || typeof raw !== "object" || !("error" in raw) || !raw.error || typeof raw.error !== "object") return false;
  const error = raw.error as { status?: unknown; details?: unknown };
  return error.status === "UNAUTHENTICATED" || (Array.isArray(error.details) && error.details.some(detail =>
    detail && typeof detail === "object" && "reason" in detail &&
    ["API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_NOT_FOUND"].includes(detail.reason)));
}

function successfulGeneration(provider: UserAiProvider, result: unknown) {
  if (!result || typeof result !== "object" || "error" in result) return false;
  if (provider === "claude") return "content" in result && Array.isArray(result.content);
  if (provider === "openai") return "choices" in result && Array.isArray(result.choices);
  if ("candidates" in result && Array.isArray(result.candidates) && result.candidates.length) return true;
  // Em modelos com thinking, um orçamento curto pode não produzir texto/candidates.
  // Uso de tokens confirma que a geração autenticada foi processada pelo modelo.
  if (!("usageMetadata" in result) || !result.usageMetadata || typeof result.usageMetadata !== "object") return false;
  const usage = result.usageMetadata as { totalTokenCount?: unknown };
  return typeof usage.totalTokenCount === "number" && Number.isFinite(usage.totalTokenCount) && usage.totalTokenCount > 0;
}

function malformedResponse(error: unknown) {
  return error instanceof SyntaxError || (error instanceof Error && ["response_too_large", "empty_response"].includes(error.message));
}

/** Uma única geração curta, sem pergunta nem dados financeiros do usuário. */
export async function validateAiKey(provider: UserAiProvider, apiKey: string, fetcher: typeof fetch = fetch) {
  const url = provider === "claude" ? "https://api.anthropic.com/v1/messages" : provider === "openai" ? OPENAI_ENDPOINT : GEMINI_ENDPOINT;
  const body = provider === "claude" ? { model: AI_MODEL, max_tokens: 8, thinking: { type: "disabled" }, messages: [{ role: "user", content: "Reply OK" }] }
    : provider === "openai" ? { model: OPENAI_MODEL, max_completion_tokens: 8, store: false, messages: [{ role: "user", content: "Reply OK" }] }
    : { contents: [{ role: "user", parts: [{ text: "Reply OK" }] }], generationConfig: { maxOutputTokens: 32, thinkingConfig: { thinkingLevel: "LOW", includeThoughts: false } } };
  const signal = AbortSignal.timeout(AI_KEY_VALIDATION_TIMEOUT_MS);
  let providerStatus: number | null = null;
  let readingResponse = false;
  try {
    const response = await fetcher(url, {
      method: "POST", cache: "no-store", redirect: "error", signal,
      headers: provider === "gemini" ? { "Content-Type": "application/json", "x-goog-api-key": apiKey }
        : { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(provider === "claude" ? { "anthropic-version": "2026-10-21" } : {}) },
      body: JSON.stringify(body),
    });
    providerStatus = response.status;
    if (!response.ok) {
      if (provider === "gemini" && response.status === 400) {
        readingResponse = true;
        let raw: unknown;
        try { raw = await limitedAiJson(response); }
        catch (error) {
          signal.throwIfAborted();
          if (!malformedResponse(error)) throw error;
          // Erro malformado não é prova de chave inválida.
        }
        throw new AiKeyValidationError(googleInvalidKey(raw) ? "invalid_api_key" : "provider_request_rejected", response.status);
      }
      await response.body?.cancel().catch(() => {});
      if ([400, 401, 403].includes(response.status)) throw new AiKeyValidationError("invalid_api_key", response.status);
      if ([402, 429].includes(response.status)) throw new AiKeyValidationError("provider_quota", response.status);
      if (response.status === 404) throw new AiKeyValidationError("provider_model_unavailable", response.status);
      if (response.status === 408) throw new AiKeyValidationError("provider_unavailable", response.status, "timeout");
      if (response.status >= 500) throw new AiKeyValidationError("provider_unavailable", response.status);
      throw new AiKeyValidationError("provider_request_rejected", response.status);
    }
    // A resposta é consumida com limite; seu conteúdo nunca é registrado ou retornado.
    readingResponse = true;
    const result = await limitedAiJson(response);
    if (!successfulGeneration(provider, result)) throw new AiKeyValidationError("provider_invalid_response", response.status);
  } catch (error) {
    if (error instanceof AiKeyValidationError) throw error;
    if (signal.aborted || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)))
      throw new AiKeyValidationError("provider_unavailable", providerStatus, "timeout");
    if (readingResponse && malformedResponse(error)) throw new AiKeyValidationError("provider_invalid_response", providerStatus);
    throw new AiKeyValidationError("provider_unavailable", providerStatus, "network");
  }
}
