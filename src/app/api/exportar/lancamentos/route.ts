import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getTransactions } from "@/server/queries";
import { monthRefFromParam, monthRefToParam, currentMonthRef } from "@/lib/dates";
import { buildExportRows, rowsToCsv } from "@/lib/export";
import { getLocale } from "@/lib/i18n/server";

export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Exporta os lançamentos como CSV, respeitando os mesmos filtros da
 * tela de Lançamentos (mês OU período customizado, categoria, tipo,
 * natureza, conta, busca) — o link "Exportar" manda exatamente a URL atual
 * da tela mais &format=..., então o que a pessoa está vendo é o que sai no
 * arquivo.
 */
export async function GET(request: NextRequest) {
  const locale = await getLocale();
  const userId = await requireUserId();
  const sp = request.nextUrl.searchParams;

  const ref = monthRefFromParam(sp.get("m"));
  const from = sp.get("from");
  const to = sp.get("to");
  const customRange =
    from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to ? { from, to } : null;

  const cat = sp.get("cat");
  const kind = sp.get("kind");
  const nature = sp.get("nature");
  const acc = sp.get("acc");
  const accountId = sp.get("accountId") || (acc && acc !== "CARD" && acc !== "OTHER" ? acc : undefined);
  const q = sp.get("q");

  const transactions = await getTransactions(
    userId,
    {
      ref: customRange ? undefined : ref,
      dateFrom: customRange?.from,
      dateTo: customRange?.to,
      categoryId: cat && cat !== "NONE" ? cat : undefined,
      uncategorized: cat === "NONE",
      accountId,
      accountKind: acc === "CARD" || acc === "OTHER" ? acc : undefined,
      kind: kind === "INCOME" || kind === "EXPENSE" ? kind : undefined,
      nature: nature === "FIXED" || nature === "VARIABLE" ? nature : undefined,
      search: q || undefined,
    },
    5000,
  );

  const rows = buildExportRows(
    transactions.map((t) => ({
      date: t.date,
      description: t.description,
      categoryName: t.categoryName,
      kind: t.kind as "INCOME" | "EXPENSE",
      nature: t.nature as "FIXED" | "VARIABLE",
      accountName: t.accountName,
      accountType: t.accountType,
      origin: t.origin,
      amountCents: t.amountCents,
      isTransfer: t.isTransfer,
      installmentNumber: t.installmentNumber,
      installmentTotal: t.installmentTotal,
      recurringRuleId: t.recurringRuleId,
      notes: t.notes,
    })), locale,
  );

  const label = customRange ? `${customRange.from}_${locale === "en" ? "to" : "a"}_${customRange.to}` : monthRefToParam(ref || currentMonthRef());
  const filename = `${locale === "en" ? "transactions" : "lancamentos"}-${label}.csv`;

  return new Response(rowsToCsv(rows, locale), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
