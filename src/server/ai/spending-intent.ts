import type { ToolName } from "@/server/telegram/ai-policy";

/** Datas civis: today já foi calculado em America/Sao_Paulo, não no fuso do host. */
export function spendingIntent(question: string, today: string) {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const card = /\bcart(?:ao|oes)\b|\bcredito\b/.test(text);
  const checking = /\bconta(?:s)? corrente(?:s)?\b|\bcorrente\b/.test(text);
  const scope = card && !checking ? "credit_card" : checking && !card ? "checking" : "all";
  if (!/\bfim (?:de |da )?semana\b|\bfinal (?:de |da )semana\b/.test(text)) return { account_scope: scope } as const;
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

/** Só completa argumentos já validados; não aceita identidade ou campos livres. */
export function scopeSpendingInput(name: ToolName | string, input: unknown, question: string, today: string) {
  if (!input || typeof input !== "object" || !["get_spending_by_category", "get_largest_expenses", "compare_months"].includes(name)) return input;
  const intent = spendingIntent(question, today);
  return { ...input, account_scope: intent.account_scope,
    ...(name !== "compare_months" && "start_date" in intent ? { start_date: intent.start_date, end_date: intent.end_date } : {}) };
}
