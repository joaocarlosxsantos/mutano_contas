import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HELP, LINKED_WELCOME } from "./commands";
export { HELP } from "./commands";

export const MAX_BODY_BYTES = 16_384;
export const MAX_TEXT_LENGTH = 512;
export const LINK_TTL_MS = 10 * 60_000;
export const CHAT_WINDOW_MS = 60_000;
export const CHAT_MAX_REQUESTS = 10;
export const codePattern = /^[A-Za-z0-9_-]{43}$/;

export function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function newLinkCode() {
  const code = randomBytes(32).toString("base64url");
  return { code, codeHash: hashCode(code), expiresAt: new Date(Date.now() + LINK_TTL_MS) };
}

export function validWebhookSecret(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

const id = z.number().int().positive().refine(Number.isSafeInteger);
const callbackSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  from: z.object({ id, is_bot: z.literal(false) }),
  message: z.object({
    message_id: id,
    date: z.number().int().positive(),
    chat: z.object({ id, type: z.literal("private") }),
    from: z.object({ id, is_bot: z.literal(true) }),
  }),
  data: z.string().min(1).max(64).refine(value => Buffer.byteLength(value, "utf8") <= 64),
});
export const updateSchema = z.object({
  update_id: z.number().int().nonnegative().max(2_147_483_647),
  message: z.object({
    message_id: id.optional(),
    text: z.string().max(MAX_TEXT_LENGTH).optional(),
    chat: z.object({ id, type: z.literal("private") }),
    from: z.object({ id, is_bot: z.literal(false) }),
  }).optional(),
  callback_query: callbackSchema.optional(),
}).refine((value) => !value.message || value.message.chat.id === value.message.from.id)
  .refine(value => !value.callback_query || value.callback_query.from.id === value.callback_query.message.chat.id)
  .refine(value => !(value.message && value.callback_query));

export type TelegramUpdate = z.infer<typeof updateSchema>;
export type TelegramMessage = NonNullable<TelegramUpdate["message"]>;
export type TelegramCallback = NonNullable<TelegramUpdate["callback_query"]>;


function commandText(text: string | undefined) {
  const value = text?.trim() ?? "";
  if (/^assinaturas$/i.test(value)) return "/assinaturas";
  // Only normalize the command token. Link codes and arguments are case-sensitive.
  return value.replace(/^\/[a-z_]+(?:@[a-z0-9_]{5,32})?(?=\s|$)/i,
    token => token.split("@")[0].toLowerCase());
}

export function isFreeQuestion(text: string | undefined) {
  if (commandText(text) === "/assinaturas") return false;
  const value = text?.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
  if (!value || value.startsWith("/")) return false;
  // Greetings and unrelated/unknown messages take the local welcome path,
  // rather than consuming AI quota. This is routing, never authorization.
  return /\b(saldos?|disponivel|investid[oa]s?|investimentos?|patrimonio|dinheiro|gastos?|gastei|gastou|gastar|compras?|despesas?|receitas?|recebi|entrou|saiu|renda|salario|categorias?|assinaturas?|faturas?|cartao|cartoes|contas?|venc\w*|pagar|paguei|pagamentos?|orcamento|economiz\w*|economia|lancamentos?|financeir\w*)\b/.test(value)
    || /\bquanto\s+(?:eu\s+)?tenho\b/.test(value)
    || /\bcompar\w*\b.*\b(mes|meses|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/.test(value);
}

export function isFinancialCommand(text: string | undefined): boolean {
  const value = commandText(text);
  return ["/saldo", "/resumo", "/previsao", "/hoje", "/assinaturas", "/relatorio", "/cartao"].includes(value)
    || value.startsWith("/cartao ")
    || value === "/resumo semana"
    || value === "/resumo semanal";
}

export interface CommandDependencies {
  consumeCode(codeHash: string, chatId: string): Promise<boolean>;
  linkedUser(chatId: string): Promise<string | null>;
  balance(userId: string): Promise<{ availableCents: number; investedCents?: number; netWorthCents?: number; totalIncomplete: boolean; needsOpeningBalance: boolean }>;
  summary?(userId: string, period?: "daily" | "weekly"): Promise<string>;
  report?(userId: string): Promise<string>;
  forecast?(userId: string): Promise<string>;
  dailyBudget?(userId: string): Promise<string>;
  subscriptions?(userId: string): Promise<string>;
  cards?(userId: string): Promise<string>;
  pause?(userId: string): Promise<void>;
  notifications?(userId: string): Promise<string>;
  undo?(userId: string): Promise<string>;
}

export async function commandReply(message: TelegramMessage, deps: CommandDependencies): Promise<string> {
  const text = commandText(message.text);
  const chatId = String(message.chat.id);
  if (text.startsWith("/start ")) {
    const code = text.slice(7);
    if (!codePattern.test(code)) return "⚠️ Esse link não é válido ou já expirou. Gere outro em Configurações.";
    const linked = await deps.consumeCode(hashCode(code), chatId);
    return linked ? LINKED_WELCOME : "⚠️ Esse link pode ter expirado ou a conta já está conectada. Desconecte no app e gere outro link.";
  }
  const isCardsCommand = text === "/cartao" || text.startsWith("/cartao ");
  if (!isFinancialCommand(text) && text !== "/pausar" && text !== "/avisos" && text !== "/desfazer") {
    const owner = await deps.linkedUser(chatId);
    return owner ? HELP : "🔗 Conecte seu Telegram em Configurações no Mutano Contas para usar o bot. Gere o link de vínculo no app.";
  }
  const userId = await deps.linkedUser(chatId);
  if (!userId) {
    if (text === "/resumo") return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar o resumo.";
    if (text === "/relatorio") return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar o relatório.";
    if (isCardsCommand) return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar cartões.";
    if (text === "/previsao") return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar a previsão.";
    if (text === "/hoje") return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar o cálculo diário.";
    if (text === "/assinaturas") return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar assinaturas.";
    if (text === "/avisos") return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar avisos.";
    if (text === "/desfazer") return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de desfazer lançamentos.";
    return "🔗 Conecte seu Telegram em Configurações no Mutano Contas antes de consultar o saldo.";
  }
  if (text === "/avisos") {
    return deps.notifications ? deps.notifications(userId) : "⚠️ Não consegui abrir seus avisos agora. Tente de novo em instantes.";
  }
  if (text === "/desfazer") {
    return deps.undo ? deps.undo(userId) : "🔎 Não encontrei um lançamento recente para desfazer.";
  }
  if (text === "/relatorio") {
    return deps.report ? deps.report(userId) : "⚠️ Não consegui buscar seu relatório agora. Tente de novo em instantes.";
  }
  if (isCardsCommand) return deps.cards ? deps.cards(userId) : "⚠️ Não consegui buscar seus cartões agora. Tente de novo em instantes.";
  if (text === "/previsao") return deps.forecast ? deps.forecast(userId) : "⚠️ Não consegui buscar sua previsão agora. Tente de novo em instantes.";
  if (text === "/hoje") return deps.dailyBudget ? deps.dailyBudget(userId) : "⚠️ Não consegui calcular o valor de hoje. Tente de novo em instantes.";
  if (text === "/assinaturas") return deps.subscriptions ? deps.subscriptions(userId) : "⚠️ Não consegui buscar suas assinaturas agora. Tente de novo em instantes.";
  if (text === "/resumo") {
    return deps.summary ? deps.summary(userId) : "⚠️ Não consegui buscar seu resumo agora. Tente de novo em instantes.";
  }
  if (text === "/resumo semana" || text === "/resumo semanal") {
    return deps.summary ? deps.summary(userId, "weekly") : "⚠️ Não consegui buscar seu resumo agora. Tente de novo em instantes.";
  }
  if (text === "/pausar") {
    if (!deps.pause) return "⚠️ Não consegui pausar agora. Tente pelo app.";
    await deps.pause(userId);
    return "✅ Avisos automáticos pausados. Quando quiser retomar, abra Configurações no app. /saldo e /resumo continuam disponíveis.";
  }
  const result = await deps.balance(userId);
  const money = (cents: number | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((typeof cents === "number" && Number.isFinite(cents) ? cents : 0) / 100);
  return `Aqui estão seus saldos registrados no app:\n💰 Disponível: ${money(result.availableCents)}\n📈 Investido: ${money(result.investedCents)}\n🏦 Patrimônio: ${money(result.netWorthCents)}` +
    (result.totalIncomplete ? "\n⚠️ Total parcial: há conta integrada sem saldo atualizado." : "") +
    (result.needsOpeningBalance ? "\n🏦 Confira os saldos iniciais das contas no app." : "");
}
