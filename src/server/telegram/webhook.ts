import { MAX_BODY_BYTES, updateSchema, validWebhookSecret, type TelegramMessage, type TelegramCallback } from "./protocol";
import { isWelcomeReply } from "./commands";
import { CALLBACK_TEXT, type InlineResult, type DetailAction, type InlineKeyboard } from "./inline-actions";
import { CHAT_SECRET_NOTICE, containsChatSecret, redactChatSecrets } from "@/lib/chat-secrets";

export type MessageDelivery = {
  remove(message: TelegramMessage): Promise<boolean>;
  background: {
    schedule(task: () => Promise<void>): void;
    send(message: TelegramMessage, text: string, keyboard?: InlineKeyboard): Promise<boolean>;
  };
};
const MESSAGE_FAILURE = "⚠️ Não consegui consultar seus dados agora. Tente de novo em instantes.";
export const TELEGRAM_MESSAGE_TIMEOUT_MS = 50_000;

export type InlineDependencies = {
  callback(updateId: number, callback: TelegramCallback): Promise<InlineResult>;
  keyboard(message: TelegramMessage, reply: string | null): Promise<InlineKeyboard | undefined>;
  details(callback: TelegramCallback, action: DetailAction): Promise<boolean>;
  background?: {
    schedule(task: () => Promise<void>): void;
    notify(callback: TelegramCallback, text: string): Promise<boolean>;
  };
};

/** Limite real sobre o stream: Content-Length pode estar ausente ou mentir. */
async function boundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}

export async function handleWebhook(
  request: Request,
  secret: string | undefined,
  processMessage: (updateId: number, message: TelegramMessage) => Promise<string | null>,
  registerMenu?: (chatId: string) => Promise<unknown>,
  inline?: InlineDependencies,
  delivery?: MessageDelivery,
) {
  const headers = { "Cache-Control": "no-store" };
  if (!secret) return Response.json({ error: "unavailable" }, { status: 503, headers });
  if (!validWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await boundedBody(request));
  } catch (error) {
    return Response.json({ error: "invalid_request" }, { status: error instanceof RangeError ? 413 : 400, headers });
  }
  let secretDetected = false;
  if (raw && typeof raw === "object" && "message" in raw && raw.message && typeof raw.message === "object"
    && "text" in raw.message && typeof raw.message.text === "string" && containsChatSecret(raw.message.text)) {
    secretDetected = true;
    // Valida identidade/contexto sem conservar o texto secreto nem depender do limite de pergunta.
    raw = { ...raw, message: { ...raw.message, text: CHAT_SECRET_NOTICE } };
  }
  const parsed = updateSchema.safeParse(raw);
  // Groups, inaccessible/inline messages, mixed updates and forged senders are ignored.
  if (!parsed.success) {
    console.info("[telegram-webhook]", { event: "update_ignored", reason: "invalid_update" });
    return Response.json({ ok: true }, { headers });
  }
  const callback = parsed.data.callback_query;
  if (callback) {
    console.info("[telegram-callback]", { event: "received" });
    if (inline?.background) {
      const { background } = inline;
      background.schedule(async () => {
        console.info("[telegram-callback]", { event: "processing" });
        let text: string;
        try {
          const result = await inline.callback(parsed.data.update_id, callback);
          if (result.details) {
            if (await inline.details(callback, result.details)) {
              console.info("[telegram-callback]", { event: "details_sent" });
              return;
            }
            console.error("[telegram-callback]", { stage: "details", status: "failed" });
            text = CALLBACK_TEXT.detailsFailed;
          } else text = result.text;
        } catch (error) {
          console.error("[telegram-callback]", { code: "callback_processing_failed" });
          text = CALLBACK_TEXT.failed;
        }
        try {
          if (!await background.notify(callback, redactChatSecrets(text))) console.error("[telegram-callback]", { stage: "notify", status: "failed" });
          else console.info("[telegram-callback]", { event: "result_sent" });
        } catch {
          console.error("[telegram-callback]", { stage: "notify", status: "failed" });
        }
      });
      // Telegram executes this method from the webhook response. No DB or outbound
      // request may delay it; after() keeps the subsequent work alive on Vercel.
      return Response.json({ method: "answerCallbackQuery", callback_query_id: callback.id, cache_time: 0 }, { headers });
    }
    let text: string = CALLBACK_TEXT.invalid;
    try {
      if (inline) {
        const result = await inline.callback(parsed.data.update_id, callback);
        text = result.text;
        if (result.details) text = await inline.details(callback, result.details) ? CALLBACK_TEXT.details : CALLBACK_TEXT.detailsFailed;
      }
    } catch { text = CALLBACK_TEXT.failed; }
    return Response.json({ method: "answerCallbackQuery", callback_query_id: callback.id, text: redactChatSecrets(text), show_alert: true, cache_time: 0 }, { headers });
  }
  if (!parsed.data.message?.text) return Response.json({ ok: true }, { headers });
  const message = parsed.data.message;
  if (secretDetected || containsChatSecret(message.text)) {
    // Não chega ao processador, parser, banco, LLM, menu, keyboard ou logs.
    // deleteMessage recebe só IDs; a falha não deve suprimir o aviso.
    try { await delivery?.remove(message); } catch { /* Best effort, sem payload em log. */ }
    return Response.json({ method: "sendMessage", chat_id: message.chat.id, text: CHAT_SECRET_NOTICE, protect_content: true }, { headers });
  }
  if (delivery && !message.text!.trim().startsWith("/")) {
    delivery.background.schedule(async () => {
      let reply: string | null;
      let keyboard: InlineKeyboard | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        reply = await Promise.race([
          processMessage(parsed.data.update_id, message),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("message_timeout")), TELEGRAM_MESSAGE_TIMEOUT_MS); }),
        ]);
        if (reply && registerMenu && isWelcomeReply(reply)) {
          try { await registerMenu(String(message.chat.id)); } catch { /* Menu opcional. */ }
        }
        if (reply && inline) {
          try { keyboard = await inline.keyboard(message, reply); } catch { /* Texto preservado sem botões. */ }
        }
      } catch {
        console.error("[telegram-webhook]", { code: "message_processing_failed" });
        reply = MESSAGE_FAILURE;
      } finally { if (timer) clearTimeout(timer); }
      if (!reply) return; // Replay/cota de entrada já tratado no processador.
      try {
        if (!await delivery.background.send(message, redactChatSecrets(reply), keyboard))
          console.warn("[telegram-webhook]", { code: "message_delivery_failed" });
      } catch { console.warn("[telegram-webhook]", { code: "message_delivery_failed" }); }
    });
    return Response.json({ ok: true }, { headers });
  }
  console.info("[telegram-webhook]", { event: "message_received" });
  try {
    const reply = await processMessage(parsed.data.update_id, parsed.data.message);
    if (registerMenu && isWelcomeReply(reply)) {
      // No registration for unlinked chats, denied contexts, replay or errors.
      try { await registerMenu(String(parsed.data.message.chat.id)); } catch { /* A menu failure must not suppress the welcome. */ }
    }
    let keyboard: InlineKeyboard | undefined;
    if (inline && reply) {
      try { keyboard = await inline.keyboard(parsed.data.message, reply); } catch { /* Preserve the original reply if optional buttons fail. */ }
    }
    console.info("[telegram-webhook]", { event: "message_completed", replied: Boolean(reply) });
    return Response.json(reply ? {
      method: "sendMessage", chat_id: parsed.data.message.chat.id, text: redactChatSecrets(reply), protect_content: true,
      ...(keyboard ? { reply_markup: keyboard } : {}),
    } : { ok: true }, { headers });
  } catch (error) {
    const err = error as { code?: unknown };
    console.error("[telegram-webhook]", {
      name: "Error",
      code: typeof err?.code === "string" && /^[0-9A-Z]{5}$/.test(err.code) ? err.code : "message_processing_failed",
    });
    // Não expor tokens, payload, chat, usuário, saldo ou mensagens do banco em logs.
    // O update já autenticado precisa de resposta no chat, não de um 5xx sem mensagem.
    return Response.json({
      method: "sendMessage", chat_id: parsed.data.message.chat.id,
      text: MESSAGE_FAILURE,
      protect_content: true,
    }, { headers });
  }
}
