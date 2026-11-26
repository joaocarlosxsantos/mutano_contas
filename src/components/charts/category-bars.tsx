"use client";

import { useLocale } from "@/lib/i18n/context";
import { getComponentsTranslator } from "@/lib/i18n/dictionaries/components";

import { getIntlLocale } from "@/lib/i18n/config";
import { formatCents, pct } from "@/lib/money";
import type { CategorySlice } from "@/server/queries";
import { CHART_CATEGORY_PALETTE } from "./palette";

/** Ranked, directly labelled bars: names and ranks carry meaning without color. */
export function CategoryBars({ slices, limit = 5, loading = false }: { slices: CategorySlice[]; limit?: number; loading?: boolean }) {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  if (loading || !slices.some((row) => row.totalCents > 0)) {
    return <p role="status" aria-busy={loading} className="flex h-40 items-center md:h-56 justify-center px-4 text-center text-sm text-[var(--text-muted)]">{loading ? t("Carregando categorias…") : t("Sem despesas no período")}</p>;
  }
  const sorted = slices.filter((row) => row.totalCents > 0).toSorted((a, b) => b.totalCents - a.totalCents);
  const total = sorted.reduce((sum, row) => sum + row.totalCents, 0);
  const count = Math.max(1, Math.min(5, Math.floor(limit) || 5));
  const rows = sorted.slice(0, count);
  const rest = sorted.slice(count);
  if (rest.length) rows.push({ id: "chart-others", name: t(rest.length === 1 ? "{count} outra categoria" : "Outras {count} categorias", { count: rest.length }), color: "", nature: "VARIABLE", totalCents: rest.reduce((sum, row) => sum + row.totalCents, 0) });
  const max = Math.max(...rows.map((row) => row.totalCents));

  return (
    <figure className="min-w-0 w-full" aria-label={t("Despesas por categoria: {total} no total.", { total: formatCents(total, locale) })}>
      <ol className="space-y-4" role="list">
        {rows.map((row, index) => (
          <li key={row.id}>
            <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
              <span className="min-w-0 break-words font-medium">
                <span className="tnum mr-2 text-[var(--text-muted)]">{index + 1}.</span>
                {row.name}{row.nature === "FIXED" ? t(" · fixo") : ""}
              </span>
              <span className="tnum flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-medium">{formatCents(row.totalCents, locale)}</span>
                <span className="text-[var(--text-muted)]">{pct(row.totalCents, total).toLocaleString(getIntlLocale(locale))}%</span>
              </span>
            </div>
            <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-sm bg-[var(--surface-2)]">
              <div className="h-full rounded-sm" style={{ width: `${(row.totalCents / max) * 100}%`, background: CHART_CATEGORY_PALETTE[index] }} />
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
