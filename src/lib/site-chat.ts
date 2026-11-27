import type { Locale } from "@/lib/i18n/config";
import { translateServer } from "@/lib/i18n/dictionaries/server";
import { BOT_COMMANDS } from "@/server/telegram/commands";

function localizednames(locale: Locale): Record<string, string> { return {
  saldo: translateServer(locale, "Saldo"), previsao: translateServer(locale, "Previsão"), hoje: translateServer(locale, "Gasto de hoje"), assinaturas: translateServer(locale, "Assinaturas"),
  resumo: translateServer(locale, "Resumo diário"), relatorio: translateServer(locale, "Relatório mensal"), cartao: translateServer(locale, "Cartões"),
  start: translateServer(locale, "Início"), menu: "Menu", ajuda: translateServer(locale, "Ajuda"), pausar: translateServer(locale, "Pausar avisos"),
}; }

// The bot's published catalog is the authority. No arbitrary text or AI path.
function localizedSITE_CHAT_COMMANDS(locale: Locale) { return [
  ...BOT_COMMANDS.map(item => ({ command: `/${item.command}`, label: localizednames(locale)[item.command] ?? item.command, description: item.description })),
  { command: "/resumo semana", label: translateServer(locale, "Resumo semanal"), description: translateServer(locale, "Ver o resumo da semana.") },
  { command: "/avisos", label: translateServer(locale, "Meus avisos"), description: translateServer(locale, "Consultar as preferências do Telegram.") },
] as const; }
export const SITE_CHAT_COMMANDS = localizedSITE_CHAT_COMMANDS("pt-BR");

const englishDescriptions: Record<string, string> = {
  saldo: "View available balance, investments and net worth.", previsao: "View the month-end forecast.",
  hoje: "See how much you can spend today.", assinaturas: "View subscriptions and price increases.",
  resumo: "View the daily summary with bills, statements and alerts.", relatorio: "View this month's report.",
  cartao: "View card statements, limits and recent purchases.", start: "Show the chat menu.",
  menu: "Show this menu.", ajuda: "Show available commands.", pausar: "Pause automatic alerts.",
};

export function getSiteChatCommands(locale: Locale = "pt-BR") {
  return localizedSITE_CHAT_COMMANDS(locale).map(item => ({ ...item,
    description: locale === "en" ? englishDescriptions[item.command.slice(1)] ?? item.description : item.description,
  }));
}

export const isSiteChatCommand = (value: unknown): value is string => typeof value === "string"
  && SITE_CHAT_COMMANDS.some(item => item.command === value);

export type ChatMessage = { id: number; role: "user" | "assistant"; text: string };
export type ChatHistoryItem = { role: "user" | "assistant"; text: string };

export function buildRecentChatHistory(messages: ChatMessage[], max = 8): ChatHistoryItem[] {
  return messages
    .filter(m => m.id !== 0 && Boolean(m.text && m.text.trim()))
    .slice(-max)
    .map(m => ({ role: m.role, text: m.text.trim() }));
}

/** Keep the launcher clear of mobile navigation/install banners at its current edge. */
export function floatingChatBottom(viewportHeight: number, anchor: { left: number; right: number }, obstacles: { left: number; right: number; top: number; height: number }[]) {
  return obstacles.reduce((bottom, rect) => rect.height > 0 && rect.left < anchor.right && rect.right > anchor.left
    ? Math.max(bottom, viewportHeight - rect.top + 16) : bottom, 24);
}
