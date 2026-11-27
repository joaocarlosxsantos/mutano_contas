"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CreditCard, Landmark, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { saveOpeningBalance } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { formatCents, formatCentsPlain } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Money } from "@/components/ui/money";
import { useLocale } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

type Account = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  color: string;
  balanceCents: number;
  openingBalanceCents: number;
  openingBalanceDate: string | null;
  incomeCents: number;
  expenseCents: number;
  transactionCount: number;
  financeMode?: string;
  bankBalanceCents?: number | null;
  bankBalanceAt?: string | null;
};

const ICONS: Record<string, LucideIcon> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  CASH: Wallet,
  INVESTMENT: TrendingUp,
};

export function AccountList({
  accounts,
  allowManual = true,
  showIntegration = true,
  locale: propLocale,
}: {
  accounts: Account[];
  allowManual?: boolean;
  showIntegration?: boolean;
  locale?: Locale;
}) {
  const contextLocale = useLocale();
  const locale = propLocale ?? contextLocale;
  const dict = getActivityDict(locale);

  if (!accounts.length) {
    return <p className="muted px-5 py-8 text-center text-[0.8125rem]">{dict["Nada por aqui."]}</p>;
  }
  return (
    <ul className="space-y-3 sm:space-y-0 sm:divide-y 2xl:grid 2xl:grid-cols-2 2xl:gap-x-6 2xl:divide-y-0 2xl:[&>li]:border-b">
      {accounts.map((account) => (
        <Row key={account.id} account={account} allowManual={allowManual} showIntegration={showIntegration} locale={locale} />
      ))}
    </ul>
  );
}

function Row({ account, allowManual, showIntegration, locale }: { account: Account; allowManual: boolean; showIntegration: boolean; locale: Locale }) {
  const dict = getActivityDict(locale);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const Icon = ICONS[account.type] ?? Wallet;

  const TYPE_LABEL: Record<string, string> = {
    CHECKING: dict["Conta corrente"],
    SAVINGS: dict["Poupança"],
    CREDIT_CARD: dict["Cartão de crédito"],
    CASH: dict["Dinheiro"],
    INVESTMENT: dict["Investimento"],
  };

  const negativo = account.balanceCents < 0;

  return (
    <li className={cn("min-w-0 rounded-xl border bg-[var(--surface)] px-3 py-3 transition-opacity sm:rounded-none sm:border-0 sm:bg-transparent sm:px-5 sm:py-4", pending && "opacity-50")}>
      <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 sm:flex sm:flex-wrap">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text)]"
        >
          <Icon className="size-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <Link href={`/lancamentos?accountId=${encodeURIComponent(account.id)}`} title={`${dict["Ver lançamentos de "]}${account.name}`} className="inline-flex min-h-11 max-w-full items-center text-sm font-medium underline decoration-[var(--line-strong)] underline-offset-4">{account.name}</Link>
          <p title={`${TYPE_LABEL[account.type] ?? account.type}${account.institution ? ` · ${account.institution}` : ""}${` · ${account.transactionCount} `}${dict[" lançamento(s)"]}`} className="muted truncate text-xs">
            {TYPE_LABEL[account.type] ?? account.type}
            {account.institution ? ` · ${account.institution}` : ""}
            {` · ${account.transactionCount} `}{dict[" lançamento(s)"]}
          </p>
        </div>

        <div className="col-start-2 min-w-0 max-w-full sm:text-right">
          {account.financeMode === "integracao" && account.bankBalanceCents === null ? <span className="text-sm font-medium">{dict["Indisponível"]}</span> : <Money
            cents={account.balanceCents}
            size="md"
            className="text-base font-semibold"
            tone={negativo ? "out" : undefined}
          />}
          <p className="muted text-xs">{account.financeMode === "integracao" ? `${showIntegration ? dict["Saldo bancário"] : dict["Saldo atualizado"]}${account.bankBalanceAt ? ` · ${formatDate(account.bankBalanceAt.slice(0, 10), locale)}` : dict[" indisponível"]}` : dict["saldo atual"]}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {account.financeMode === "manual" ? <span className="muted">
          {dict["Inicial "]}{formatCents(account.openingBalanceCents, locale)}
          {account.openingBalanceDate ? `${dict[" em "]}${formatDate(account.openingBalanceDate, locale)}` : ""}
        </span> : null}
        {account.financeMode === "manual" ? <span className="muted">
          + {formatCents(account.incomeCents, locale)}{dict[" entraram · − "]}{formatCents(account.expenseCents, locale)}{" "}
          {dict[" saíram"]}
        </span> : null}
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[var(--text-in)]">
            <Check className="size-3.5" />
            {dict["salvo"]}
          </span>
        ) : null}
        {allowManual && account.financeMode === "manual" ? <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="min-h-11 min-w-11 ml-auto cursor-pointer font-medium text-[var(--text-brand)] hover:underline"
        >
          {editing ? dict["Fechar"] : dict["Ajustar saldo inicial"]}
        </button> : null}
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-[var(--text-out)]">{error}</p>}
      {editing && allowManual && account.financeMode === "manual" ? (
        <form
          className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:grid-cols-[minmax(0,1fr)_1fr_auto] sm:items-end"
          action={(formData) => {
            start(async () => {
              setError("");
              const result = await saveOpeningBalance({
                accountId: account.id,
                amount: String(formData.get("amount") ?? "0"),
                date: String(formData.get("date") ?? "") || null,
              });
              if (result.error) { setError(result.error); return; }
              setEditing(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            });
          }}
        >
          <Field label={dict["Saldo inicial (R$)"]}>
            <Input className="min-h-12 min-w-0 max-w-full text-base!"
              name="amount"
              inputMode="decimal"
              defaultValue={formatCentsPlain(account.openingBalanceCents, locale)}
            />
          </Field>
          <Field label={dict["Nesta data"]} hint={dict["Lançamentos anteriores param de contar."]}>
            <Input className="min-h-12 min-w-0 max-w-full text-base!" name="date" type="date" defaultValue={account.openingBalanceDate ?? ""} />
          </Field>
          <Button className="min-h-11 min-w-11" type="submit" size="sm" disabled={pending}>
            {dict["Salvar"]}
          </Button>
        </form>
      ) : null}
    </li>
  );
}
