import type { ToolName } from "@/server/telegram/ai-policy";

export type SpendingContext = {
  start_date?: string;
  end_date?: string;
  account_scope?: "all" | "credit_card" | "checking";
};

export function isListingIntent(question: string): boolean {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:quais\s+(?:foram|sao|as\s+transac(?:ao|oes)|transac(?:ao|oes)|compras|gastos|despesas)|detalh(?:a|e|ar|es)?|list(?:a|ar|e|agem)?|extrato|ver\s+transac(?:ao|oes)|mostr(?:a|e|ar)\s+transac(?:ao|oes))\b/.test(text)
    || /^\s*(?:quais(?:\s+foram)?|detalha|detalhe|lista|liste)\s*\??\s*$/.test(text);
}

export function isFollowUpQuestion(question: string): boolean {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (isListingIntent(question)) return true;
  if (/^e\s+(?:no|na|nos|nas|em|para|de)\b/.test(text)) return true;
  if (/^(?:so|somente)\s+(?:no|na|em|o|a)?\s*(?:cart(?:ao|oes)|credito|conta|corrente)\b/.test(text)) return true;
  if (/^(?:no|na)\s+(?:cart(?:ao|oes)|credito|conta|corrente)\s*\??$/.test(text)) return true;
  return false;
}

function hasExplicitPeriod(text: string): boolean {
  return /\b(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|mes|ano|hoje|ontem|dias?|\d{4}|\d{1,2}\/\d{1,2})\b/.test(text);
}

/** Datas civis: today já foi calculado em America/Sao_Paulo, não no fuso do host. */
export function spendingIntent(question: string, today: string, previousContext?: SpendingContext) {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const card = /\bcart(?:ao|oes)\b|\bcredito\b/.test(text);
  const checking = /\bconta(?:s)? corrente(?:s)?\b|\bcorrente\b/.test(text);
  let scope: "all" | "credit_card" | "checking" = card && !checking ? "credit_card" : checking && !card ? "checking" : "all";

  if (!card && !checking && previousContext?.account_scope) {
    scope = previousContext.account_scope;
  }

  if (/\bfim (?:de |da )?semana\b|\bfinal (?:de |da )semana\b/.test(text)) {
    const day = new Date(`${today}T00:00:00Z`);
    const weekday = day.getUTCDay();
    const offset = (weekday + 1) % 7;
    let start = new Date(day.getTime() - offset * 86_400_000);
    if (weekday >= 6 || weekday === 0) {
      if (/\b(?:passad[oa]|anterior|ultimo)\b/.test(text)) start = new Date(start.getTime() - 7 * 86_400_000);
    }
    const end = new Date(Math.min(start.getTime() + 86_400_000, day.getTime()));
    return { account_scope: scope, start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) } as const;
  }

  if (previousContext?.start_date && previousContext?.end_date && !hasExplicitPeriod(text)) {
    if (isFollowUpQuestion(question) || isListingIntent(question)) {
      return {
        account_scope: scope,
        start_date: previousContext.start_date,
        end_date: previousContext.end_date,
      } as const;
    }
  }

  return { account_scope: scope } as const;
}

/** Só completa argumentos já validados; não aceita identidade ou campos livres. */
export function scopeSpendingInput(name: ToolName | string, input: unknown, question: string, today: string, previousContext?: SpendingContext) {
  if (!input || typeof input !== "object" || !["get_spending_by_category", "get_largest_expenses", "compare_months", "list_transactions"].includes(name)) return input;
  const intent = spendingIntent(question, today, previousContext);
  return { ...input, account_scope: intent.account_scope,
    ...(name !== "compare_months" && "start_date" in intent ? { start_date: intent.start_date, end_date: intent.end_date } : {}) };
}
