import { redactChatSecrets } from "@/lib/chat-secrets";
import type { TelegramMessage } from "./protocol";
import type { InlineKeyboard } from "./inline-actions";

async function telegramCall(method: "deleteMessage" | "sendMessage", body: unknown, token: string | undefined, fetcher: typeof fetch) {
  if (!token) return false;
  try {
    const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3_000),
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data: unknown = await response.json();
    return response.ok && data !== null && typeof data === "object" && "ok" in data && data.ok === true;
  } catch { return false; } // Nunca registrar URL com token nem resposta do Telegram.
}

export async function deleteSecretMessage(message: TelegramMessage, token = process.env.TELEGRAM_BOT_TOKEN, fetcher: typeof fetch = fetch) {
  if (!message.message_id) return false;
  return telegramCall("deleteMessage", { chat_id: message.chat.id, message_id: message.message_id }, token, fetcher);
}

export async function sendMessageResult(message: TelegramMessage, text: string, keyboard?: InlineKeyboard,
  token = process.env.TELEGRAM_BOT_TOKEN, fetcher: typeof fetch = fetch) {
  return telegramCall("sendMessage", { chat_id: message.chat.id, text: redactChatSecrets(text), protect_content: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  }, token, fetcher);
}
