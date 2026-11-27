import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import { MobileDisclosure } from "@/components/ui/mobile-disclosure";
import { TrendingDown } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { getDebtOverview, getMonthSummary, getUser } from "@/server/queries";
import { currentMonthRef } from "@/lib/dates";
import { formatCents, pct } from "@/lib/money";
import { balanceCents } from "@/lib/finance";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { EmptyState } from "@/components/ui/empty";
import { DebtList } from "./debt-list";
import { DebtComposer } from "./debt-composer";
import { PayoffPlanner } from "./payoff-planner";

function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Dívidas") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }

export default async function DebtsPage() {
  const locale = await getLocale().catch(() => "pt-BR" as const);
  const userId = await requireUserId();
  const ref = currentMonthRef();

  const [user, overview, summary] = await Promise.all([
    getUser(userId),
    getDebtOverview(userId),
    getMonthSummary(userId, ref),
  ]);

  const income = user.monthlyIncomeCents;
  const sobra = Math.max(0, balanceCents(summary));
  const extraSugerido = Math.max(0, sobra - overview.totalMinimumCents);
  const comprometido = income ? pct(overview.totalMinimumCents, income) : 0;
  const jurosSobreRenda = income ? pct(overview.totalMonthlyInterestCents, income) : 0;

  return (
    <>
      <PageHeader
        title={translatePlanning(locale, "Dívidas")}
        description={translatePlanning(locale, "Sair da dívida é um problema de ordem, não de força de vontade. Aqui você vê quanto os juros custam por mês e qual sequência de quitação sai mais barato.")}
      />

      {!overview.debts.length ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="min-w-0 p-0">
            <EmptyState
              icon={TrendingDown}
              title={translatePlanning(locale, "Nenhuma dívida cadastrada")}
              description={translatePlanning(locale, "Se você não tem dívida, ótimo — pule esta tela. Se tem, cadastrar é o passo que transforma um problema difuso em um plano com data para acabar.")}
            />
          </Card>
          <Card className="min-w-0">
            <CardHeader title={translatePlanning(locale, "Cadastrar dívida")} subtitle={translatePlanning(locale, "Comece pela de maior juros.")} />
            <MobileDisclosure label={translatePlanning(locale, "Preencher dívida")}><DebtComposer /></MobileDisclosure>
          </Card>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <Card className="min-w-0">
              <CardHeader
                title={translatePlanning(locale, "O tamanho do buraco")}
                subtitle={translatePlanning(locale, "O primeiro passo é enxergar o número real.")}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Metric
                  label={translatePlanning(locale, "Saldo devedor")}
                  value={formatCents(overview.totalBalanceCents, locale)}
                  tone="bad"
                />
                <Metric
                  label={translatePlanning(locale, "Juros por mês")}
                  value={formatCents(overview.totalMonthlyInterestCents, locale)}
                  hint={income ? translatePlanning(locale, "{0}% da sua renda", jurosSobreRenda) : undefined}
                  tone="bad"
                />
                <Metric
                  label={translatePlanning(locale, "Mínimos por mês")}
                  value={formatCents(overview.totalMinimumCents, locale)}
                  hint={income ? translatePlanning(locale, "{0}% da sua renda", comprometido) : undefined}
                />
              </div>

              <div className="mt-4">
                <Hint tone={overview.totalMonthlyInterestCents > 0 ? "warn" : "info"}>
                  {overview.totalMonthlyInterestCents > 0 ? (
                    <>
                      {translatePlanning(locale, "Só de juros, essas dívidas custam")}{" "}
                      <strong>{formatCents(overview.totalMonthlyInterestCents, locale)} {translatePlanning(locale, "por mês")}</strong> {translatePlanning(locale, "— esse é o valor que some da sua vida sem comprar nada. Pagar só o mínimo significa que boa parte disso se repete no mês seguinte.")} </>
                  ) : (
                    <>
                      {translatePlanning(locale, "Nenhuma dessas dívidas está cobrando juros. Se alguma cobra, informe a taxa para o plano ficar realista.")} </>
                  )}
                </Hint>
              </div>
            </Card>

            <Card className="min-w-0 p-0">
              <div className="border-b px-5 py-4">
                <h2 className="text-[0.9375rem] font-semibold tracking-tight">{translatePlanning(locale, "Suas dívidas")}</h2>
                <p className="muted mt-0.5 text-[0.8125rem]">
                  {translatePlanning(locale, "Da que cobra mais juros para a que cobra menos. Clique nos valores para editar.")} </p>
              </div>
              <DebtList debts={overview.debts} />
            </Card>

            <PayoffPlanner
              debts={overview.debts.map((d) => ({
                id: d.id,
                name: d.name,
                balanceCents: d.balanceCents,
                monthlyRateBps: d.monthlyRateBps,
                minimumPaymentCents: d.minimumPaymentCents,
              }))}
              suggestedExtraCents={extraSugerido}
              totalMinimumCents={overview.totalMinimumCents}
            />
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="min-w-0">
              <CardHeader title={translatePlanning(locale, "Cadastrar dívida")} />
              <MobileDisclosure label={translatePlanning(locale, "Preencher dívida")}><DebtComposer /></MobileDisclosure>
            </Card>

            <Hint tone="tip" title={translatePlanning(locale, "A ordem que funciona")}>
              {translatePlanning(locale, "Antes de investir, quite o que cobra juros alto — nenhum investimento seguro paga 13% ao mês. A exceção é uma reserva mínima de um mês de custo de vida: sem ela, qualquer imprevisto vira dívida nova e o esforço recomeça do zero.")} </Hint>
          </div>
        </div>
      )}
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "bad";
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="muted text-xs">{label}</p>
      <p
        className="tnum mt-1 text-xl font-semibold tracking-tight"
        style={tone === "bad" ? { color: "var(--text-out)" } : undefined}
      >
        {value}
      </p>
      {hint ? <p className="muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
