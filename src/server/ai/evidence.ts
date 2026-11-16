import { z } from "zod";
import { AI_NO_DATA, safeAnswer } from "@/server/telegram/ai-policy";
import { categoryLabel, dueBillLabel } from "./redaction";
import type { HelpChunk } from "./knowledge/catalog";

export type FinancialEvidence = { name: string; value: unknown };
const cents = z.number().refine(Number.isSafeInteger);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^20\d{2}-(?:0[1-9]|1[0-2])$/);
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

/** Valores e rótulos vêm de DTOs validados; texto livre do modelo não é prova. */
function financialBlock({ name, value }: FinancialEvidence): string | null {
  if (name === "get_balance") {
    const parsed = z.object({ availableCents: cents, investedCents: cents, netWorthCents: cents, partial: z.boolean(), checkOpeningBalance: z.boolean() }).safeParse(value);
    if (!parsed.success) return null;
    const data = parsed.data;
    return `💰 Seu saldo atual${data.partial ? " (parcial)" : ""}:\n💰 Disponível: ${money(data.availableCents)}\n📈 Investido: ${money(data.investedCents)}\n🏦 Patrimônio líquido: ${money(data.netWorthCents)}`
      + (data.partial ? "\n⚠️ Falta atualizar um saldo integrado. Este total é parcial." : "")
      + (data.checkOpeningBalance ? "\n🏦 Confira os saldos iniciais no app." : "");
  }
  if (name === "get_spending_by_category" || name === "get_largest_expenses") {
    const parsed = z.object({ start: date, end: date, accountScope: z.enum(["all", "credit_card", "checking"]).optional(), totalCents: cents.optional(), includesPending: z.boolean().optional(), rows: z.array(z.object({ category: z.string(), amountCents: cents, date: date.optional() })).max(5) }).safeParse(value);
    if (!parsed.success) return null;
    const data = parsed.data;
    const scope = data.accountScope === "credit_card" ? "só cartão de crédito" : data.accountScope === "checking" ? "só conta corrente" : "todas as contas, incluindo cartão";
    return `${name === "get_largest_expenses" ? "📤 Suas maiores despesas" : "🏷️ Seus gastos por categoria"} — 📅 ${data.start} a ${data.end} (${scope}):\n`
      + (data.totalCents !== undefined ? `💰 Total do período: ${money(data.totalCents)}\n` : "")
      + (data.rows.map((row, index) => `${row.date ? "📅 " + row.date + " · " : ""}🏷️ ${categoryLabel(row.category, index)}: ${money(row.amountCents)}`).join("\n") || "🔎 Não encontrei registros nesse período.")
      + "\n📋 Até 5 itens. Uso a data do lançamento/compra e o valor de cada parcela, sem contar o pagamento da fatura."
      + (data.includesPending ? "\n⚠️ Inclui compras de cartão pendentes: total provisório." : "");
  }
  if (name === "list_transactions") {
    const rowSchema = z.object({
      date,
      description: z.string(),
      amountCents: cents,
      accountType: z.string(),
      pending: z.boolean().optional(),
    });
    const parsed = z.object({
      start: date,
      end: date,
      accountScope: z.enum(["all", "credit_card", "checking"]).optional(),
      includesPending: z.boolean().optional(),
      rows: z.array(rowSchema).max(20),
    }).safeParse(value);
    if (!parsed.success) return null;
    const data = parsed.data;
    const scope = data.accountScope === "credit_card" ? "só cartão de crédito" : data.accountScope === "checking" ? "só conta corrente" : "todas as contas, incluindo cartão";
    const lines: string[] = [];
    for (const row of data.rows) {
      const badge = row.pending ? " · ⚠️ pendente" : "";
      const line = `📅 ${row.date} · 🛍️ ${row.description}: 💰 ${money(row.amountCents)} (${row.accountType}${badge})`;
      if ([...lines, line].join("\n").length > 950) {
        lines.push(`... e mais ${data.rows.length - lines.length} transações.`);
        break;
      }
      lines.push(line);
    }
    return `Aqui estão suas transações — 📅 ${data.start} a ${data.end} (${scope}):\n`
      + (lines.join("\n") || "🔎 Não encontrei transações nesse período.")
      + (data.includesPending ? "\n⚠️ Inclui compras de cartão pendentes: provisório." : "");
  }
  if (name === "compare_months") {
    const parsed = z.object({ rows: z.array(z.object({ month, incomeCents: cents, expenseCents: cents, includesPending: z.boolean().optional() })).length(2) }).safeParse(value);
    if (!parsed.success) return null;
    return "📅 Vamos comparar os meses registrados:\n" + parsed.data.rows.map(row => `📅 ${row.month}: 📥 entradas ${money(row.incomeCents)}, 📤 despesas ${money(row.expenseCents)}${row.includesPending ? " (provisório: inclui cartão pendente)" : ""}`).join("\n");
  }
  if (name === "get_due_bills") {
    const parsed = z.object({ rows: z.array(z.object({ date, totalCents: cents })).max(5) }).safeParse(value);
    if (!parsed.success) return null;
    return "🧾 Suas contas a vencer (até 5, valores totais da conta):\n" + (parsed.data.rows.map((row, index) => `🧾 ${dueBillLabel(index)} · 📅 ${row.date}: 💰 ${money(row.totalCents)}`).join("\n") || "🔎 Não encontrei contas nesse intervalo.");
  }
  return null;
}

export function validHelpCitations(text: string, chunks: readonly HelpChunk[]) {
  const ids = new Set(chunks.map(chunk => chunk.id));
  return [...text.matchAll(/\[ajuda:([^\]]*)\]/g)].every(match => ids.has(match[1]));
}

export function groundedReply(chunks: readonly HelpChunk[], evidence: readonly FinancialEvidence[]): string {
  const blocks: string[] = [];
  for (const result of evidence.slice(0, 4)) {
    const block = financialBlock(result);
    if (block && [...blocks, block].join("\n\n").length <= 1400) blocks.push(block);
  }
  const hasFinancialEvidence = blocks.length > 0;
  for (const chunk of chunks.slice(0, hasFinancialEvidence ? 1 : 2)) {
    const lines: string[] = [];
    for (const line of chunk.text.split("\n").filter(line => line.trim() && !line.startsWith("###"))) {
      if ([...lines, line].join("\n").length > 420) break;
      lines.push(line);
    }
    if (!lines.length) continue;
    const block = `${chunk.title}\n${lines.join("\n")}\nFonte: Ajuda — ${chunk.title} [${chunk.id}]`;
    if ([...blocks, block].join("\n\n").length <= 1650) blocks.push(block);
  }
  if (!blocks.length) return AI_NO_DATA;
  if (!hasFinancialEvidence) blocks.push("💬 Para consultar seus valores, me diga o período que você quer ver. Seus dados financeiros ainda não foram consultados.");
  return safeAnswer(blocks.join("\n\n"), []);
}
