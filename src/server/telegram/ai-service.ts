import { todayRef } from "@/lib/dates";
import type { UsageProfile } from "@/lib/usage-profile";
import { getUsageProfile } from "@/server/usage-profile";
import { askClaude, askGemini, askOpenai } from "./ai";
import { loadAiCredential } from "@/server/ai/credentials-store";
import { selectAiProvider } from "./ai-provider";
import { AI_FAILURE, AI_LIMITED, AI_UNAVAILABLE } from "./ai-policy";
import { consumeAiQuota } from "./ai-quota";
import { executeReadTool } from "./ai-tools";

export const PROFILE_INSTRUCTIONS: Record<UsageProfile, string> = {
  integracao_total: "Perfil do app: integração total. Não sugira cadastro, importação ou lançamento manual. Atualizações de movimentação vêm da integração; planejamento no app continua disponível.",
  hibrido: "Perfil do app: híbrido. O usuário pode usar integração e dados manuais no app. Você continua exclusivamente de leitura.",
  manual: "Perfil do app: somente manual. Não sugira conexão ou sincronização Open Finance. As atualizações são feitas pelo usuário no app, nunca pelo bot.",
};

/** Chamado apenas após resolver userId do chat no servidor, fora da transação do webhook. */
export async function answerQuestion(userId: string, chatId: string, question: string, now = new Date(), personalOnly = false): Promise<string> {
  try {
    const credential = await loadAiCredential(userId);
    const provider = credential ? (credential.provider === "claude" ? "anthropic" : credential.provider) : personalOnly ? null : selectAiProvider();
    if (!provider) return AI_UNAVAILABLE;
    if (!await consumeAiQuota(chatId, now)) return AI_LIMITED;
    const profile = await getUsageProfile(userId);
    if (!PROFILE_INSTRUCTIONS[profile]) return AI_FAILURE;
    const today = todayRef(now);
    const deps = {
      runTool: (name, input) => executeReadTool(userId, name, input, today),
    } satisfies Parameters<typeof askClaude>[3];
    if (credential) {
      const env = { ANTHROPIC_API_KEY: provider === "anthropic" ? credential.apiKey : undefined,
        GEMINI_API_KEY: provider === "gemini" ? credential.apiKey : undefined,
        OPENAI_API_KEY: provider === "openai" ? credential.apiKey : undefined,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET, CRON_SECRET: process.env.CRON_SECRET };
      const ask = provider === "openai" ? askOpenai : provider === "gemini" ? askGemini : askClaude;
      return await ask(question, today, PROFILE_INSTRUCTIONS[profile], deps, env);
    }
    const ask = provider === "gemini" ? askGemini : askClaude;
    return await ask(question, today, PROFILE_INSTRUCTIONS[profile], deps);
  } catch { return AI_FAILURE; }
}
