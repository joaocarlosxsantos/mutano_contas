import { auth } from "@/lib/auth";
import { boundedJson } from "@/server/notifications/http";
import { aiCredentialSchema } from "@/server/ai/credentials-schema";
import { claimAiCredentialRequest, getAiCredentialStatus, removeAiCredential, saveAiCredential } from "@/server/ai/credentials-store";
import { AiKeyValidationError, validateAiKey } from "@/server/ai/validate-key";
import { siteChatOwnerExists } from "@/server/telegram/site-chat";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const errorResponse = (code: string, error: string, status: number, extra = {}) => Response.json({ code, error }, { status, headers: { ...headers, ...extra } });

async function handle(request: Request, method: "GET" | "PUT" | "DELETE") {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId || !await siteChatOwnerExists(userId)) return errorResponse("unauthorized", "Entre na sua conta novamente.", 401);
    if (method !== "GET" && (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site"))
      return errorResponse("invalid_origin", "Origem inválida.", 403);
    const limit = await claimAiCredentialRequest(userId, method !== "GET");
    if (!limit.allowed) return errorResponse("rate_limited", "Muitas tentativas. Aguarde um minuto.", 429, { "Retry-After": String(limit.retryAfterSeconds) });
    if (method === "GET") return Response.json(await getAiCredentialStatus(userId), { headers });
    if (method === "DELETE") return Response.json(await removeAiCredential(userId), { headers });
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return errorResponse("unsupported_media_type", "Envie provider e apiKey em JSON.", 415);
    let input;
    try { input = aiCredentialSchema.safeParse(await boundedJson(request)); }
    catch { return errorResponse("invalid_input", "JSON inválido ou corpo acima de 8 KiB.", 400); }
    if (!input.success) return errorResponse("invalid_input", "Provedor ou formato de chave inválido.", 400);
    await validateAiKey(input.data.provider, input.data.apiKey);
    return Response.json(await saveAiCredential(userId, input.data.provider, input.data.apiKey), { headers });
  } catch (error) {
    if (error instanceof AiKeyValidationError) {
      if (error.code === "invalid_api_key") return errorResponse(error.code, "Chave rejeitada pelo provedor. Confira a chave e as permissões do modelo.", 422);
      if (error.code === "provider_quota") return errorResponse(error.code, "O provedor informou falta de crédito ou limite de uso. Confira sua conta e tente novamente.", 422);
      return errorResponse(error.code, "Não foi possível validar no provedor agora. Tente novamente.", 503);
    }
    // Nunca registrar exceções do banco/provedor: podem conter credenciais.
    return errorResponse("service_unavailable", "Não foi possível acessar a configuração de IA. Tente novamente.", 503);
  }
}

export const GET = (request: Request) => handle(request, "GET");
export const PUT = (request: Request) => handle(request, "PUT");
export const DELETE = (request: Request) => handle(request, "DELETE");
