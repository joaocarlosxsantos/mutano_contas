"use server";

import type { Locale } from "@/lib/i18n/config";
import { translateServer } from "@/lib/i18n/dictionaries/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions, transactionSplits } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { MAX_CENTS } from "@/lib/money";
import { safeNameSchema, safeOptionalTextSchema } from "@/server/validation/sanitization";
import { computeSplit } from "@/lib/splits";

export type ActionState = { error?: string; ok?: boolean };

function isTableMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  if (e.code === "42P01") return true;
  if (e.cause && typeof e.cause === "object") {
    const cause = e.cause as Record<string, unknown>;
    if (cause.code === "42P01") return true;
    if (cause.cause && typeof cause.cause === "object" && (cause.cause as Record<string, unknown>).code === "42P01") {
      return true;
    }
  }
  return false;
}

function localizedsplitPersonSchema(locale: Locale) { return z.object({
  name: safeNameSchema(1, 100, translateServer(locale, "O nome não pode ser vazio.")),
  phone: safeOptionalTextSchema(30),
  amount: z.number().int().min(0).max(MAX_CENTS).optional(),
  basisPoints: z.number().int().min(0).max(10_000).optional(),
  percent: z.number().min(0).max(100).optional(),
}); }
const splitPersonSchema = localizedsplitPersonSchema("pt-BR");

function localizedsetTransactionSplitSchema(locale: Locale) { return z.object({
  mode: z.enum(["EQUAL", "PERCENT", "VALUE"]),
  myIncluded: z.boolean(),
  others: z
    .array(splitPersonSchema)
    .min(1, translateServer(locale, "Informe ao menos uma pessoa para dividir."))
    .max(20, translateServer(locale, "O limite máximo é de 20 pessoas.")),
}); }

export type SetTransactionSplitInput = z.infer<ReturnType<typeof localizedsetTransactionSplitSchema>>;

/**
 * Registra ou atualiza a divisão de um lançamento entre outras pessoas.
 * O lançamento mantém o seu valor total inalterado.
 * A parte do dono não é gravada no banco (minha parte = total - soma dos outros).
 */
export async function setTransactionSplit(
  transactionId: string,
  input: SetTransactionSplitInput,
): Promise<ActionState> {
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const userId = await requireUserId();

  if (!transactionId || typeof transactionId !== "string") {
    return { error: translateServer(locale, "Lançamento inválido.") };
  }

  const parsed = localizedsetTransactionSplitSchema(locale).safeParse(input);
  if (!parsed.success) {
    return { error: translateServer(locale, parsed.error.issues[0]?.message ?? translateServer(locale, "Dados inválidos.")) };
  }

  const [tx] = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      amountCents: transactions.amountCents,
      kind: transactions.kind,
      isTransfer: transactions.isTransfer,
    })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .limit(1);

  if (!tx) {
    return { error: translateServer(locale, "Lançamento não encontrado.") };
  }

  if (tx.isTransfer) {
    return { error: translateServer(locale, "Não é possível dividir transferências entre contas.") };
  }

  if (tx.kind !== "EXPENSE") {
    return { error: translateServer(locale, "Apenas despesas podem ser divididas.") };
  }

  if (tx.amountCents > MAX_CENTS) {
    return { error: translateServer(locale, "Valor do lançamento excede o teto permitido (20 milhões).") };
  }

  const splitResult = computeSplit(
    tx.amountCents,
    parsed.data.mode,
    parsed.data.others,
    parsed.data.myIncluded,
  );

  if (!splitResult.ok) {
    return { error: translateServer(locale, splitResult.error) };
  }

  try {
    await db.transaction(async (trx) => {
      // Remove qualquer divisão anterior deste lançamento
      await trx
        .delete(transactionSplits)
        .where(
          and(
            eq(transactionSplits.transactionId, transactionId),
            eq(transactionSplits.userId, userId),
          ),
        );

      // Grava as partes de cada outra pessoa (dono não é gravado)
      if (splitResult.amounts.length > 0) {
        await trx.insert(transactionSplits).values(
          splitResult.amounts.map((a) => ({
            userId,
            transactionId,
            name: a.name,
            phone: a.phone || null,
            amountCents: a.amountCents,
          })),
        );
      }
    });

    revalidatePath("/lancamentos");
    revalidatePath("/painel");
    return { ok: true };
  } catch (err) {
    // ponytail: remover este fallback depois que migration 0011 estiver aplicada em producao
    if (isTableMissingError(err)) {
      return { error: translateServer(locale, "Divisao indisponivel: migration pendente") };
    }
    throw err;
  }
}

/**
 * Remove a divisão de um lançamento, voltando-o a ser integral do dono.
 */
export async function clearTransactionSplit(transactionId: string): Promise<ActionState> {
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const userId = await requireUserId();

  if (!transactionId || typeof transactionId !== "string") {
    return { error: translateServer(locale, "Lançamento inválido.") };
  }

  const [tx] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .limit(1);

  if (!tx) {
    return { error: translateServer(locale, "Lançamento não encontrado.") };
  }

  try {
    await db
      .delete(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId),
        ),
      );

    revalidatePath("/lancamentos");
    revalidatePath("/painel");
    return { ok: true };
  } catch (err) {
    // ponytail: remover este fallback depois que migration 0011 estiver aplicada em producao
    if (isTableMissingError(err)) {
      return { error: translateServer(locale, "Divisao indisponivel: migration pendente") };
    }
    throw err;
  }
}
