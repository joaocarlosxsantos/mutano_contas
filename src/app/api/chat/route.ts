import { translateServer } from "@/lib/i18n/dictionaries/server";
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
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const secretNotice = locale === "en"
    ? "🔒 To protect your data, do not paste keys here. Configure AI in My account. If you already shared a key, revoke it with the provider and generate another."
    : CHAT_SECRET_NOTICE;
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return error(translateServer(locale, "🔒 Entre na sua conta para conversar por aqui."), 401);
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site")
      return error(translateServer(locale, "⚠️ Não consegui validar esta consulta. Abra o chat pelo app."), 403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return error(translateServer(locale, "⚠️ Não consegui ler a consulta. Escolha uma opção do menu."), 415);
    if (!(await siteChatOwnerExists(userId))) return error(translateServer(locale, "🔒 Sua sessão terminou. Entre de novo."), 401);
    const limit = await claimSiteChatRequest(userId);
    if (!limit.allowed) return error(translateServer(locale, "⏳ Aguarde um minuto antes de consultar de novo."), 429, { "Retry-After": String(limit.retryAfterSeconds) });
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
    catch { return error(translateServer(locale, "💬 Não reconheci esse comando. Escolha uma opção do menu."), 400); }
    if (!input.success) return error(translateServer(locale, "💬 Não reconheci esse comando. Escolha uma opção do menu."), 400);
    const data = input.data;
    if (secretDetected || ("message" in data && containsChatSecret(data.message))) return Response.json({ reply: secretNotice }, { headers });
    if ("history" in data && data.history?.some((h) => containsChatSecret(h.text))) return Response.json({ reply: secretNotice }, { headers });
    const reply = "command" in data ? await siteCommandReply(userId, data.command)
      : locale === "en"
        ? await withOpenFinanceAge(userId, async () => (await import("@/server/telegram/site-chat")).englishSiteQuestion(userId, data.message, new Date(), data.history), new Date(), locale)
        : await withOpenFinanceAge(userId, () => answerQuestion(userId, `site:${userId}`, data.message, new Date(), true, ...(data.history ? [data.history] : [])));
    const safeReply = reply ? redactChatSecrets(reply) : reply;
    return Response.json({ reply: locale === "en" ? safeReply?.replaceAll("[segredo removido]", "[secret removed]") : safeReply }, { headers });
  } catch {
    return error(translateServer(locale, "⚠️ Não consegui consultar agora. Tente de novo em instantes."), 503);
  }
}
