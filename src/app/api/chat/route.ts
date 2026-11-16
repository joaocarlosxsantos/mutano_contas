import { z } from "zod";
import { auth } from "@/lib/auth";
import { isSiteChatCommand } from "@/lib/site-chat";
import { boundedJson } from "@/server/notifications/http";
import { claimSiteChatRequest, siteChatOwnerExists, siteCommandReply } from "@/server/telegram/site-chat";
import { answerQuestion } from "@/server/telegram/ai-service";
import { withOpenFinanceAge } from "@/server/open-finance/data-age";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const inputSchema = z.union([
  z.object({ command: z.string().max(32).refine(isSiteChatCommand) }).strict(),
  z.object({ message: z.string().trim().min(1).max(512).refine(value => !value.startsWith("/")) }).strict(),
]);
const error = (message: string, status: number, extra = {}) => Response.json({ error: message }, { status, headers: { ...headers, ...extra } });

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return error("Entre na sua conta para usar o chat.", 401);
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site")
      return error("Origem inválida.", 403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return error("Envie um comando em JSON.", 415);
    if (!(await siteChatOwnerExists(userId))) return error("Sessão encerrada. Entre novamente.", 401);
    const limit = await claimSiteChatRequest(userId);
    if (!limit.allowed) return error("Muitas consultas. Aguarde um minuto e tente novamente.", 429, { "Retry-After": String(limit.retryAfterSeconds) });
    let input;
    try { input = inputSchema.safeParse(await boundedJson(request)); }
    catch { return error("Comando inválido. Escolha uma opção do menu.", 400); }
    if (!input.success) return error("Comando inválido. Escolha uma opção do menu.", 400);
    const data = input.data;
    const reply = "command" in data ? await siteCommandReply(userId, data.command)
      : await withOpenFinanceAge(userId, () => answerQuestion(userId, `site:${userId}`, data.message, new Date(), true));
    return Response.json({ reply }, { headers });
  } catch {
    return error("Não foi possível consultar agora. Tente novamente.", 503);
  }
}
