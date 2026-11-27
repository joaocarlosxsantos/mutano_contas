import { getUsageProfile } from "@/server/usage-profile";
import { canUseCapability } from "@/lib/usage-profile";
import { NewAccount } from "./new-account";
import { Wallet } from "lucide-react";
import { requireUserId } from "@/lib/auth";
import { getBalances } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { EmptyState } from "@/components/ui/empty";
import { Money } from "@/components/ui/money";
import { type Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";
import { AccountList } from "./account-list";

async function resolveLocale(): Promise<Locale> {
  try {
    const { getLocale } = await import("@/lib/i18n/server");
    return await getLocale();
  } catch {
    return "pt-BR";
  }
}

export async function generateMetadata() {
  const locale = await resolveLocale();
  const dict = getActivityDict(locale);
  return { title: dict["Saldos"] };
}

export default async function AccountsPage() {
  const locale = await resolveLocale();
  const dict = getActivityDict(locale);
  const userId = await requireUserId();
  const profile = await getUsageProfile(userId);
  const manualEntry = canUseCapability(profile, "manual-entry");
  const overview = await getBalances(userId);

  if (!overview.accounts.length) {
    return (
      <>
        <PageHeader title={dict["Contas e saldos"]} description={dict["Seu dinheiro por conta."]} action={<NewAccount />} />
        <Card className="min-w-0 p-0 max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none">
          <EmptyState
            icon={Wallet}
            title={dict["Nenhuma conta cadastrada"]}
            description={dict["Crie sua primeira conta para acompanhar o saldo."]}
            action={<NewAccount />}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={dict["Contas e saldos"]}
        description={dict["Seu dinheiro por conta."]}
        action={<NewAccount />}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {manualEntry && overview.needsOpeningBalance ? (
            <Hint tone="tip" title={dict["Informe o saldo inicial"]}>
              {dict["Alguma conta está sem saldo inicial. Informe o saldo na data de referência para conciliação correta com o extrato bancário."]}
            </Hint>
          ) : null}
          {overview.totalIncomplete ? <Hint tone="info" title={dict["Total incompleto"]}>{dict["Há conta integrada sem snapshot bancário disponível. O consolidado fica incompleto até a próxima sincronização."]}</Hint> : null}

          <Card className="min-w-0 p-0 max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h2 className="text-[0.75rem] font-semibold tracking-normal text-[var(--text-muted)]">
                {dict["Saldos"]}
              </h2>
              <p className="muted mt-0.5 text-xs">{dict["Saldo atualizado de cada conta e acesso aos lançamentos."]}</p>
            </div>
            <AccountList
              locale={locale}
              allowManual={manualEntry}
              showIntegration={canUseCapability(profile, "integration")}
              accounts={overview.accounts.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                institution: a.institution,
                color: a.color,
                balanceCents: a.balanceCents,
                financeMode: a.financeMode,
                bankBalanceCents: a.bankBalanceCents,
                bankBalanceAt: a.bankBalanceAt?.toISOString() ?? null,
                openingBalanceCents: a.openingBalanceCents,
                openingBalanceDate: a.openingBalanceDate
                  ? a.openingBalanceDate.toISOString().slice(0, 10)
                  : null,
                incomeCents: a.incomeCents,
                expenseCents: a.expenseCents,
                transactionCount: a.transactionCount,
              }))}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="min-w-0">
            <CardHeader
              title={dict["Patrimônio líquido"]}
              subtitle={dict["Total em contas menos saldo de dívidas."]}
            />
            <div className="mb-4">
              {!overview.totalIncomplete ? <Money
                cents={overview.netWorthCents}
                size="hero"
                className="font-medium"
                tone={overview.netWorthCents < 0 ? "out" : undefined}
              /> : <p className="text-2xl font-semibold">{dict["Total incompleto"]}</p>}
            </div>

            <ul className="space-y-2.5 text-[0.8125rem]">
              <Row label={dict["Disponível em contas"]} value={overview.availableCents} incomplete={overview.totalIncomplete} incompleteLabel={dict["Total incompleto"]} />
              {overview.accounts.some((account) => account.type === "INVESTMENT") ? <Row label={dict["Investido"]} value={overview.investedCents} incomplete={overview.accounts.some((account) => account.type === "INVESTMENT" && account.financeMode === "integracao" && account.bankBalanceCents === null)} incompleteLabel={dict["Total incompleto"]} /> : null}
              <Row label={dict["Guardado em metas"]} value={overview.savedInGoalsCents} />
              <Row label={dict["Dívidas"]} value={-overview.debtBalanceCents} negative />
            </ul>

            <p className="muted mt-4 text-xs leading-relaxed">
              {overview.totalIncomplete ? dict["Total incompleto: falta snapshot bancário de uma ou mais contas integradas."] : dict["Consolidação baseada em saldos manuais e snapshots bancários disponíveis."]}
            </p>
          </Card>

        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  negative,
  incomplete,
  incompleteLabel,
}: {
  label: string;
  value: number;
  negative?: boolean;
  incomplete?: boolean;
  incompleteLabel?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="muted">{label}</span>
      {incomplete && (label.includes("Disponível") || label.includes("Available")) ? <span className="text-xs font-medium">{incompleteLabel ?? "Total incompleto"}</span> : <Money
        cents={value}
        size="sm"
        className="font-semibold"
        tone={negative && value !== 0 ? "out" : undefined}
      />}
    </li>
  );
}
