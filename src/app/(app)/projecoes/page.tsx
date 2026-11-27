import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import { requireUserId } from "@/lib/auth";
import { getBalances, getMonthSummary, getTotalSavedCents, getUser } from "@/server/queries";
import { InvestmentSummary } from "@/components/investment-summary";
import { investmentPosition, projectionOpeningCents } from "@/lib/investments";
import { currentMonthRef } from "@/lib/dates";
import { balanceCents } from "@/lib/finance";
import { PageHeader } from "@/components/page-header";
import { ProjectionStudio } from "./projection-studio";

function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Projeções") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }

export default async function ProjectionsPage() {
  const locale = await getLocale().catch(() => "pt-BR" as const);
  const userId = await requireUserId();
  const ref = currentMonthRef();

  const [user, saved, summary, balances] = await Promise.all([
    getUser(userId),
    getTotalSavedCents(userId),
    getMonthSummary(userId, ref),
    getBalances(userId),
  ]);

  const sobra = Math.max(0, balanceCents(summary));
  const suggested = sobra > 0 ? sobra : Math.round((user.monthlyIncomeCents * user.savingsTargetPct) / 100);

  return (
    <>
      <PageHeader
        title={translatePlanning(locale, "Projeções")}
        description={translatePlanning(locale, "Onde o seu dinheiro chega se você mantiver o ritmo. Mexa nos controles e compare cenários — é o mesmo cálculo de juros compostos que os bancos usam.")}
      />
      <InvestmentSummary balance={balances}>
        {investmentPosition(balances).incomplete ? translatePlanning(locale, "Complete a sincronização. A simulação usa o valor guardado em metas enquanto o saldo investido estiver parcial.") : translatePlanning(locale, "A simulação começa pelo saldo investido atual, que você pode ajustar nos controles.")}
      </InvestmentSummary>
      <ProjectionStudio startCents={projectionOpeningCents(balances, saved)} suggestedMonthlyCents={suggested} />
    </>
  );
}
