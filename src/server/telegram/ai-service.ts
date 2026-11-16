import { todayRef } from "@/lib/dates";
import type { UsageProfile } from "@/lib/usage-profile";
import { getUsageProfile } from "@/server/usage-profile";
import { askClaude, askGemini, askOpenai } from "./ai";
import { loadAiCredential } from "@/server/ai/credentials-store";
import { selectAiProvider } from "./ai-provider";
import { AI_FAILURE, AI_LIMITED, AI_UNAVAILABLE, GEMINI_TELEGRAM_TIMEOUT_MS } from "./ai-policy";
import { CHAT_SECRET_NOTICE, containsChatSecret } from "@/lib/chat-secrets";
import { consumeAiQuota } from "./ai-quota";
import { executeReadTool } from "./ai-tools";
import { retrieveKnowledge } from "@/server/ai/knowledge/retrieve";
import { redactQuestion } from "@/server/ai/redaction";
import { scopeSpendingInput, spendingIntent } from "@/server/ai/spending-intent";
import { groundedReply } from "@/server/ai/evidence";

export const PROFILE_INSTRUCTIONS: Record<UsageProfile, string> = {
  integracao_total: "Perfil do app: integração total. Não sugira cadastro, importação ou lançamento manual. Atualizações de movimentação vêm da integração; planejamento no app continua disponível.",
  hibrido: "Perfil do app: híbrido. O usuário pode usar integração e dados manuais no app. Você continua exclusivamente de leitura.",
  manual: "Perfil do app: somente manual. Não sugira conexão ou sincronização Open Finance. As atualizações são feitas pelo usuário no app, nunca pelo bot.",
};

/** Chamado apenas após resolver userId do chat no servidor, fora da transação do webhook. */
export async function answerQuestion(userId: string, chatId: string, question: string, now = new Date(), personalOnly = false): Promise<string> {
  if (containsChatSecret(question)) return CHAT_SECRET_NOTICE;
  let stage = "credential_lookup";
  try {
    const credential = await loadAiCredential(userId);
    const provider = credential ? (credential.provider === "claude" ? "anthropic" : credential.provider) : personalOnly ? null : selectAiProvider();
    if (!provider) {
      console.info("[chat-ai]", { status: null, code: "provider_not_configured" });
      return AI_UNAVAILABLE;
    }
    stage = "quota_lookup";
    if (!await consumeAiQuota(chatId, now)) return AI_LIMITED;
    stage = "profile_lookup";
    const profile = await getUsageProfile(userId);
    if (!PROFILE_INSTRUCTIONS[profile]) return AI_FAILURE;
    const today = todayRef(now);
    const safeQuestion = redactQuestion(question);
    const knowledge = { profile, chunks: retrieveKnowledge(safeQuestion, profile) };
    const intent = spendingIntent(safeQuestion, today);
    // Consulta fechada: não depender de o modelo escolher saldo em vez de gastos.
    if ("start_date" in intent && /\b(?:gast|despes|compr|quanto)/i.test(safeQuestion.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      stage = "spending_lookup";
      const name = /\bmaior(?:es)?\b/i.test(safeQuestion) ? "get_largest_expenses" : "get_spending_by_category";
      const value = await executeReadTool(userId, name, { ...intent, ...(name === "get_largest_expenses" ? { limit: 5 } : {}) }, today);
      return groundedReply(knowledge.chunks, [{ name, value }]);
    }
    const deps = {
      runTool: (name, input) => executeReadTool(userId, name, scopeSpendingInput(name, input, safeQuestion, today), today),
      knowledge,
      ...(provider === "gemini" && !chatId.startsWith("site:") ? { timeoutMs: GEMINI_TELEGRAM_TIMEOUT_MS } : {}),
    } satisfies Parameters<typeof askClaude>[3];
    stage = "provider_call";
    if (credential) {
      const env = { ANTHROPIC_API_KEY: provider === "anthropic" ? credential.apiKey : undefined,
        GEMINI_API_KEY: provider === "gemini" ? credential.apiKey : undefined,
        OPENAI_API_KEY: provider === "openai" ? credential.apiKey : undefined,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET, CRON_SECRET: process.env.CRON_SECRET };
      const ask = provider === "openai" ? askOpenai : provider === "gemini" ? askGemini : askClaude;
      return await ask(safeQuestion, today, PROFILE_INSTRUCTIONS[profile], deps, env);
    }
    const ask = provider === "gemini" ? askGemini : askClaude;
    return await ask(safeQuestion, today, PROFILE_INSTRUCTIONS[profile], deps);
  } catch {
    console.warn("[chat-ai]", { status: null, code: `${stage}_failed` });
    return AI_FAILURE;
  }
}
