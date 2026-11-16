import { z } from "zod";
import { auth } from "@/lib/auth";
import { isSiteChatCommand } from "@/lib/site-chat";
import { boundedJson } from "@/server/notifications/http";
import { claimSiteChatRequest, siteChatOwnerExists, siteCommandReply } from "@/server/telegram/site-chat";
import { answerQuestion } from "@/server/telegram/ai-service";
import { withOpenFinanceAge } from "@/server/open-finance/data-age";
import { CHAT_SECRET_NOTICE, containsChatSecret, redactChatSecrets } from "@/lib/chat-secrets";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const chatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(1800),
});
const inputSchema = z.union([
  z.object({ command: z.string().max(32).refine(isSiteChatCommand) }).strict(),
  z.object({
    message: z.string().trim().min(1).max(512).refine((value) => !value.startsWith("/")),
    history: z.array(chatHistoryItemSchema).max(20).optional(),
  }).strict(),
]);
const error = (message: string, status: number, extra = {}) => Response.json({ error: message }, { status, headers: { ...headers, ...extra } });

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return error("🔒 Entre na sua conta para conversar por aqui.", 401);
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site")
      return error("⚠️ Não consegui validar esta consulta. Abra o chat pelo app.", 403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return error("⚠️ Não consegui ler a consulta. Escolha uma opção do menu.", 415);
    if (!(await siteChatOwnerExists(userId))) return error("🔒 Sua sessão terminou. Entre de novo.", 401);
    const limit = await claimSiteChatRequest(userId);
    if (!limit.allowed) return error("⏳ Aguarde um minuto antes de consultar de novo.", 429, { "Retry-After": String(limit.retryAfterSeconds) });
    let input;
    let secretDetected = false;
    try {
      let body = await boundedJson(request);
      if (body && typeof body === "object" && "message" in body && typeof body.message === "string" && containsChatSecret(body.message)) {
        secretDetected = true;
        body = { ...body, message: CHAT_SECRET_NOTICE };
      }
      input = inputSchema.safeParse(body);
    }
    catch { return error("💬 Não reconheci esse comando. Escolha uma opção do menu.", 400); }
    if (!input.success) return error("💬 Não reconheci esse comando. Escolha uma opção do menu.", 400);
    const data = input.data;
    if (secretDetected || ("message" in data && containsChatSecret(data.message))) return Response.json({ reply: CHAT_SECRET_NOTICE }, { headers });
    if ("history" in data && data.history?.some((h) => containsChatSecret(h.text))) return Response.json({ reply: CHAT_SECRET_NOTICE }, { headers });
    const reply = "command" in data ? await siteCommandReply(userId, data.command)
      : await withOpenFinanceAge(userId, () => answerQuestion(userId, `site:${userId}`, data.message, new Date(), true, ...(data.history ? [data.history] : [])));
    return Response.json({ reply: reply ? redactChatSecrets(reply) : reply }, { headers });
  } catch {
    return error("⚠️ Não consegui consultar agora. Tente de novo em instantes.", 503);
  }
}
