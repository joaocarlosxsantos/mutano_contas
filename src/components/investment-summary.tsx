"use client";

import { useLocale } from "@/lib/i18n/context";
import { getComponentsTranslator } from "@/lib/i18n/dictionaries/components";

import { getIntlLocale } from "@/lib/i18n/config";
import Link from "next/link";
import { Money } from "@/components/ui/money";
import { investmentPosition } from "@/lib/investments";
import type { BalancesOverview } from "@/server/queries";

export function InvestmentSummary({ balance, children }: { balance: BalancesOverview; children?: React.ReactNode }) {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  const position = investmentPosition(balance);
  if (!position.hasInvestments) return null;
  return (
    <section aria-label={t("Posição atual dos investimentos")} className="mb-5 border-b border-[var(--line)] pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Investimentos hoje")}</h2>
        <Link href="/contas" className="inline-flex min-h-11 items-center text-sm text-[var(--text-brand)] hover:underline">{t("Ver contas")}</Link>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="muted">{t("Disponível")}</dt><dd><Money cents={balance.availableCents} size="sm" /></dd></div>
        <div><dt className="muted">{t("Investido")}{position.incomplete ? t(" (parcial)") : ""}</dt><dd><Money cents={balance.investedCents} size="sm" /></dd></div>
        <div><dt className="muted">{t("Patrimônio líquido")}{balance.totalIncomplete ? t(" (parcial)") : ""}</dt><dd><Money cents={balance.netWorthCents} size="sm" /></dd></div>
      </dl>
      <p className="muted mt-2 text-xs">
        {position.sharePct !== null ? t("{share}% do patrimônio líquido está investido. ", { share: position.sharePct.toLocaleString(getIntlLocale(locale)) }) : ""}
        {t("Saldos atuais. Aplicações e resgates ficam fora de Entrou/Saiu.")}</p>
      {children ? <p className="muted mt-2 text-xs">{children}</p> : null}
    </section>
  );
}
