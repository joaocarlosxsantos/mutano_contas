import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import { MobileDisclosure } from "@/components/ui/mobile-disclosure";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { getBudgetOverview, getUser } from "@/server/queries";
import { monthRefFromParam, monthLabel } from "@/lib/dates";
import { formatCents, pct } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card, CardHeader } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/ui/money";
import { BudgetList } from "./budget-list";
import { BudgetStarters } from "./budget-starters";

function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Orçamento") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const locale = await getLocale().catch(() => "pt-BR" as const);
  const userId = await requireUserId();
  const { m } = await searchParams;
  const ref = monthRefFromParam(m);

  const [user, overview] = await Promise.all([getUser(userId), getBudgetOverview(userId, ref)]);

  const hasBudgets = overview.rows.some((r) => r.limitCents !== null);
  const estourou = overview.rows.filter((r) => r.status === "estourou");
  const atencao = overview.rows.filter((r) => r.status === "atencao");
  const semLimite = overview.rows.filter((r) => r.status === "sem-limite" && r.spentCents > 0);

  const income = user.monthlyIncomeCents || overview.incomeCents;
  const sobraOrcada = income - overview.totalLimitCents;
  const usoDoOrcamento = overview.totalLimitCents
    ? (overview.budgetedSpentCents / overview.totalLimitCents) * 100
    : 0;

  return (
    <>
      <PageHeader
        title={translatePlanning(locale, "Orçamento")}
        description={translatePlanning(locale, "Limites e consumo por categoria.")}
        action={<MonthSwitcher value={ref} />}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {!hasBudgets ? (
            <Card className="min-w-0">
              <CardHeader
                title={translatePlanning(locale, "Nenhum limite definido em {0}", monthLabel(ref, locale))}
                subtitle={translatePlanning(locale, "Comece por um dos dois caminhos — depois é só ajustar o que não fizer sentido.")}
              />
              <MobileDisclosure label={translatePlanning(locale, "Sugerir ou copiar limites")}><BudgetStarters
                monthRef={ref}
                canCopyPrevious={overview.previousMonthHasBudgets}
              /></MobileDisclosure>
            </Card>
          ) : null}

          <Card className="min-w-0 p-0 max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight">
                  {translatePlanning(locale, "Limites de")} {monthLabel(ref, locale)}
                </h2>
                <p className="muted mt-0.5 text-[0.8125rem]">
                  {translatePlanning(locale, "Clique no valor para editar. Zerar o campo remove o limite.")} </p>
              </div>
              {hasBudgets ? (
                <BudgetStarters
                  monthRef={ref}
                  canCopyPrevious={overview.previousMonthHasBudgets}
                  compact
                />
              ) : null}
            </div>

            <BudgetList rows={overview.rows} monthRef={ref} />
          </Card>

          {overview.uncategorizedSpentCents > 0 ? (
            <Hint tone="warn">
              <strong>{formatCents(overview.uncategorizedSpentCents, locale)}</strong> {translatePlanning(locale, "em lançamentos sem categoria neste mês. Enquanto ficarem assim, esse gasto não entra em nenhum limite —")}{" "}
              <Link href="/lancamentos" className="inline-flex min-h-11 items-center font-semibold underline">
                {translatePlanning(locale, "classifique na tela de lançamentos")} </Link>
              .
            </Hint>
          ) : null}

          {semLimite.length ? (
            <Hint tone="info">
              {semLimite.length} {translatePlanning(locale, "categoria(s) gastaram neste mês sem limite definido, somando")}{" "}
              <strong>{formatCents(overview.unbudgetedSpentCents, locale)}</strong>{translatePlanning(locale, ". Defina um teto para elas e o orçamento passa a cobrir o mês inteiro.")} </Hint>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="min-w-0">
            <CardHeader
              title={translatePlanning(locale, "Resumo do mês")}
              subtitle={translatePlanning(locale, "Considera só o gasto das categorias que têm limite.")}
            />

            <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Money cents={overview.budgetedSpentCents} size="hero" />
              <span className="muted tnum text-[0.8125rem]">
                {translatePlanning(locale, "de")} {formatCents(overview.totalLimitCents, locale)} {translatePlanning(locale, "orçados")} </span>
            </div>
            <Progress
              label={translatePlanning(locale, "Quanto do orçamento do mês já foi consumido")}
              value={usoDoOrcamento}
              color={
                usoDoOrcamento > 100
                  ? "var(--color-money-out)"
                  : usoDoOrcamento >= 80
                    ? "var(--color-variable)"
                    : "var(--color-money-in)"
              }
              height={6}
            />

            <ul className="mt-5 space-y-3 text-[0.8125rem]">
              <Line label={translatePlanning(locale, "Estouraram o limite")} value={String(estourou.length)} tone={estourou.length ? "bad" : "good"} />
              <Line label={translatePlanning(locale, "Perto do limite")} value={String(atencao.length)} tone={atencao.length ? "warn" : "good"} />
              <Line
                label={translatePlanning(locale, "Gastaram sem limite")}
                value={String(semLimite.length)}
                tone={semLimite.length ? "warn" : "good"}
              />
              <Line
                label={translatePlanning(locale, "Comprometido da renda")}
                value={income ? `${pct(overview.totalLimitCents, income)}%` : "—"}
              />
              <Line
                label={sobraOrcada >= 0 ? translatePlanning(locale, "Sobraria no orçamento") : translatePlanning(locale, "Orçamento acima da renda")}
                value={formatCents(Math.abs(sobraOrcada), locale)}
                tone={sobraOrcada >= 0 ? "good" : "bad"}
              />
            </ul>
          </Card>

          {overview.totalLimitCents > 0 && income > 0 ? (
            <Hint tone={sobraOrcada >= 0 ? "good" : "warn"}>
              {sobraOrcada >= 0 ? (
                <>
                  {translatePlanning(locale, "Seus limites somam")} <strong>{pct(overview.totalLimitCents, income)}%</strong> {translatePlanning(locale, "da renda. O que sobrar do orçamento é o que vai para a reserva e para as metas.")} </>
              ) : (
                <>
                  {translatePlanning(locale, "A soma dos limites passa da sua renda em")}{" "}
                  <strong>{formatCents(Math.abs(sobraOrcada), locale)}</strong>{translatePlanning(locale, ". Mesmo cumprindo tudo à risca o mês fecharia no vermelho — vale rever os tetos maiores.")} </>
              )}
            </Hint>
          ) : null}

          <Card className="min-w-0">
            <CardHeader
              title={translatePlanning(locale, "Como o alerta funciona")}
              subtitle={translatePlanning(locale, "Três estados, para você agir antes do estouro.")}
            />
            <ul className="space-y-2.5 text-[0.8125rem]">
              <Legend color="var(--color-money-in)" label={translatePlanning(locale, "Até 79% do limite")} desc={translatePlanning(locale, "No ritmo")} />
              <Legend color="var(--color-variable)" label={translatePlanning(locale, "De 80% a 100%")} desc={translatePlanning(locale, "Pise no freio")} />
              <Legend color="var(--color-money-out)" label={translatePlanning(locale, "Acima de 100%")} desc={translatePlanning(locale, "Estourou")} />
            </ul>
            <p className="muted mt-4 text-xs leading-relaxed">
              {translatePlanning(locale, "A projeção ao lado de cada categoria estima o fechamento do mês mantendo o ritmo atual de gasto. Serve para perceber o estouro no dia 10, não no dia 30.")} </p>
            <div className="mt-4">
              <Link
                href="/lancamentos"
                className="inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-[var(--text-brand)] hover:underline"
              >
                {translatePlanning(locale, "Ver os lançamentos do mês →")} </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "bad"
      ? "text-[var(--text-out)]"
      : tone === "warn"
        ? "text-[var(--text-warn)]"
        : tone === "good"
          ? "text-[var(--text-in)]"
          : "";
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="muted">{label}</span>
      <span className={`tnum font-semibold ${color}`}>{value}</span>
    </li>
  );
}

function Legend({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
      <span className="font-medium">{label}</span>
      <span className="muted ml-auto text-xs">{desc}</span>
    </li>
  );
}
