"use client";

import { useUsageProfile } from "@/components/usage-profile";
import { canUseCapability } from "@/lib/usage-profile";
import { EditTransactionForm } from "./edit-transaction-form";
import { useState, useTransition } from "react";
import { ArrowLeftRight, CreditCard, Plus, Repeat, Trash2, Users } from "lucide-react";
import {
  deleteTransaction,
  setTransactionCategory,
  setTransactionCardPayment,
  setTransactionTransfer,
} from "@/server/actions/transactions";
import { deletePluggyTransaction } from "@/server/actions/open-finance";
import { recategorizeUncategorizedTransactions } from "@/server/actions/categorization";
import { formatCents } from "@/lib/money";
import { investmentMovementLabel } from "@/lib/investments";
import { formatDayMonth } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/sheet";
import { Field, Select } from "@/components/ui/field";
import { useLocale } from "@/lib/i18n/context";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";
import { SplitDialog } from "./split-dialog";
import { TransferDialog } from "./transfer-dialog";
import type { PlainAccount, PlainCategory, PlainTransaction } from "./types";

export function TransactionList({
  transactions,
  categories,
  accounts,
  isFilteredByAccount,
}: {
  transactions: PlainTransaction[];
  categories: PlainCategory[];
  accounts: PlainAccount[];
  isFilteredByAccount?: boolean;
}) {
  const locale = useLocale();
  const dict = getActivityDict(locale);
  const profile = useUsageProfile();
  const manualEntry = canUseCapability(profile, "manual-entry");
  const [transferOpen, setTransferOpen] = useState(false);
  const [recategorizing, startRecategorizing] = useTransition();
  const [categorizationMessage, setCategorizationMessage] = useState("");
  const grouped = groupByDate(transactions);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
        <span className="text-xs font-semibold tracking-normal text-[var(--text-muted)]">
          {dict["Lançamentos"]}
        </span>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {transactions.some((transaction) => !transaction.categoryId && !transaction.isTransfer) ? (
            <Button type="button" variant="outline" size="sm" disabled={recategorizing} onClick={() => startRecategorizing(async () => {
              const result = await recategorizeUncategorizedTransactions();
              setCategorizationMessage("error" in result ? String(result.error ?? dict["Falha ao categorizar."]) : `${result.updated} categorizados · ${result.counts.user} por seu histórico, ${result.counts.rule + result.counts.dictionary} por regras`);
            })} className="min-h-11 min-w-11 text-xs">
              {recategorizing ? dict["Categorizando…"] : dict["Categorizar não categorizados"]}
            </Button>
          ) : null}
          {manualEntry && <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const composer = document.querySelector<HTMLInputElement>('input[name="description"]');
              composer?.focus();
              composer?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="hidden min-h-11 min-w-11 cursor-pointer gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] md:inline-flex"
          >
            <Plus className="size-3.5" />
            {dict["Novo lançamento"]}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTransferOpen(true)}
            aria-label={dict["Nova transferência"]}
            className="min-h-11 min-w-11 cursor-pointer gap-1.5 text-xs font-medium text-[var(--text-brand)] hover:bg-[var(--color-save-soft)]"
          >
            <ArrowLeftRight className="size-3.5" />
            <span className="hidden sm:inline">{dict["Nova transferência"]}</span>
          </Button>
          </>}
        </div>
      </div>
      {categorizationMessage ? <p role="status" className="border-b border-[var(--line)] px-4 py-2 text-xs text-[var(--text-muted)]">{categorizationMessage}</p> : null}

      <div className="divide-y divide-[var(--line)]">
        {grouped.map(([date, items]) => {
          const dayTotalCents = items
            .filter((t) => !t.isTransfer)
            .reduce(
              (acc, t) => acc + (t.kind === "INCOME" ? t.amountCents : -t.amountCents),
              0,
            );
          return (
            <div key={date}>
              <div className="flex items-center justify-between border-y border-[var(--line)] bg-[var(--surface-2)] px-4 py-1.5 text-xs font-medium text-[var(--text-muted)]">
                <span className="capitalize">{formatDayMonth(date, locale)}</span>
                <span
                  className={cn(
                    "tnum font-mono text-xs font-semibold",
                    dayTotalCents > 0
                      ? "text-[var(--text-in)]"
                      : dayTotalCents < 0
                        ? "text-[var(--text-out)]"
                        : "text-[var(--text-muted)]",
                  )}
                >
                  {dayTotalCents > 0 ? "+" : dayTotalCents < 0 ? "−" : ""}{" "}
                  {formatCents(Math.abs(dayTotalCents), locale)}
                </span>
              </div>
              <ul className="divide-y divide-[var(--line)]">
                {items.map((t) => (
                  <Row
                    key={t.id}
                    tx={t}
                    categories={categories}
                    isFilteredByAccount={isFilteredByAccount}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {transferOpen && manualEntry ? (
        <TransferDialog
          isOpen={transferOpen}
          onClose={() => setTransferOpen(false)}
          accounts={accounts}
        />
      ) : null}
    </div>
  );
}

function Row({
  tx,
  categories,
  isFilteredByAccount,
}: {
  tx: PlainTransaction;
  categories: PlainCategory[];
  isFilteredByAccount?: boolean;
}) {
  const locale = useLocale();
  const dict = getActivityDict(locale);
  const profile = useUsageProfile();
  const manualEntry = canUseCapability(profile, "manual-entry");
  const [pending, start] = useTransition();
  const [splitOpen, setSplitOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const confirm = useConfirm();
  const options = categories.filter((c) => c.kind === tx.kind);
  const canSplit = tx.kind === "EXPENSE" && !tx.isTransfer;
  const isSplit = Boolean(tx.splits && tx.splits.length > 0);
  const isPairedTransfer = Boolean(tx.transferGroupId);

  const showSignedTransfer = isPairedTransfer && Boolean(isFilteredByAccount);
  const isNeutralValue = tx.isTransfer && !showSignedTransfer;

  const valueSignal = isNeutralValue
    ? ""
    : tx.kind === "INCOME"
      ? "+"
      : "−";

  const valueColorClass = isNeutralValue
    ? "text-[var(--text-muted)]"
    : tx.kind === "INCOME"
      ? "text-[var(--text-in)]"
      : "text-[var(--text-out)]";

  const displayName = isPairedTransfer && !isFilteredByAccount && tx.transferRoute
    ? tx.transferRoute
    : tx.accountName;

  function chooseCategory(value: string) {
    setCategoryError("");
    start(async () => {
      try { await setTransactionCategory(tx.id, value || null); }
      catch { setCategoryError(dict["Não foi possível alterar a categoria. Tente novamente."]); }
    });
  }

  const rowActions = <>
      {canSplit ? (
        <button
          type="button"
          aria-label={
            isSplit
              ? `${dict["Editar divisão de "]}${tx.description}`
              : `${dict["Dividir "]}${tx.description}`
          }
          title={
            isSplit
              ? `${dict["Dividido com "]}${tx.splits!.length}${dict[" pessoa(s). Clique para editar"]}`
              : dict["Dividir despesa com outras pessoas"]
          }
          disabled={pending}
          onClick={() => setSplitOpen(true)}
          className={["inline-flex items-center justify-center",["min-h-11 min-w-11", cn(
            "shrink-0 cursor-pointer rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--surface-2)]",
            isSplit ? "text-[var(--text-brand)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
          )].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
        >
          <Users className="size-3.5" />
        </button>
      ) : null}

      {!isPairedTransfer && tx.origin !== "PLUGGY" ? (
        <button
          type="button"
          aria-label={
            tx.isTransfer
              ? `${dict["Voltar a contar "]}${tx.description}${dict[" nos totais"]}`
              : `${dict["Marcar "]}${tx.description}${dict[" como transferência"]}`
          }
          title={
            tx.isTransfer
              ? dict["Voltar a contar nos totais"]
              : dict["Marcar como transferência entre contas suas"]
          }
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setTransactionTransfer(tx.id, !tx.isTransfer);
            })
          }
          className={["inline-flex items-center justify-center",["min-h-11 min-w-11", cn(
            "shrink-0 cursor-pointer rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--surface-2)]",
            tx.isTransfer ? "text-[var(--text-brand)]" : "text-[var(--text-muted)]",
          )].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
        >
          <ArrowLeftRight className="size-3.5" />
        </button>
      ) : null}

      {tx.origin !== "PLUGGY" ? <button
        type="button"
        aria-label={`${dict["Excluir "]}${tx.description}`}
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: isPairedTransfer
              ? `${dict["Excluir transferência \""]}${tx.description}${dict["\"?"]}`
              : `${dict["Excluir \""]}${tx.description}${dict["\"?"]}`,
            description: isPairedTransfer
              ? dict["Isto apaga as duas pernas da transferência (origem e destino)."]
              : undefined,
            confirmLabel: dict["Excluir"],
            tone: "danger",
          });
          if (!ok) return;
          start(async () => {
            await deleteTransaction(tx.id);
          });
        }}
        className="inline-flex items-center justify-center min-h-11 min-w-11 shrink-0 cursor-pointer rounded-[var(--radius-xs)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-money-out-soft)] hover:text-[var(--text-out)]"
      >
        <Trash2 className="size-3.5" />
      </button> : <button
        type="button"
        aria-label={`${dict["Excluir lançamento Pluggy "]}${tx.description}`}
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: `${dict["Excluir lançamento importado \""]}${tx.description}${dict["\"?"]}`,
            description: dict["Este lançamento será removido e ficará bloqueado contra reimportação na próxima sincronização. Esta ação não pode ser desfeita."],
            confirmLabel: dict["Excluir lançamento"],
            tone: "danger",
          });
          if (!ok) return;
          start(async () => { await deletePluggyTransaction({ transactionId: tx.id, confirmation: "EXCLUIR LANCAMENTO PLUGGY" }); });
        }}
        className="inline-flex items-center justify-center min-h-11 min-w-11 shrink-0 cursor-pointer rounded-[var(--radius-xs)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-money-out-soft)] hover:text-[var(--text-out)]"
      >
        <Trash2 className="size-4" />
      </button>}

  </>;

  return (
    <li id={`transaction-${tx.id}`} className={cn("flex min-h-14 scroll-mt-24 flex-wrap items-center gap-2 px-4 py-3 transition-opacity target:bg-[var(--surface-2)]", pending && "opacity-50")}>
      <span
        className="hidden size-2 shrink-0 rounded-full md:block"
        style={{ background: tx.categoryColor ?? "var(--text-muted)" }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setCategoryOpen(true)} className="min-h-11 max-w-full cursor-pointer text-left text-sm font-medium text-[var(--text)]" aria-label={`${dict["Ver "]}${tx.description}`}>
          <span className="block line-clamp-2 break-words">{tx.description}</span><span className="block text-xs font-normal text-[var(--text-muted)] md:hidden">{tx.categoryName ?? dict["Sem categoria"]}</span>
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
          {!tx.isTransfer || tx.origin === "PLUGGY" ? (
            <select
              aria-label={dict["Categoria"]}
              value={tx.categoryId ?? ""}
              disabled={pending}
              onChange={(e) => chooseCategory(e.target.value)}
              className="hidden min-h-11 max-w-full cursor-pointer rounded-xl border bg-[var(--surface-2)] px-3 text-base md:block"
            >
              <option value="">{dict["Sem categoria"]}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}

          {tx.externalStatus === "PENDING" ? <span className="rounded bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-warn)]">{dict["provisório · pendente"]}</span> : null}

          {tx.accountType === "INVESTMENT" ? <span className="rounded-[var(--radius-xs)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs ring-1 ring-[var(--border)] ring-inset">{investmentMovementLabel(tx) ?? "Investimento"}</span> : null}

          {tx.isTransfer ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--color-save-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-brand)]"
              title={dict["Movimento entre contas suas — fora dos totais"]}
            >
              <ArrowLeftRight className="size-3" />
              {dict["transferência"]}
            </span>
          ) : tx.kind === "EXPENSE" ? (
            <span className="rounded-[var(--radius-xs)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs ring-1 ring-[var(--border)] ring-inset">
              {tx.nature === "FIXED" ? dict["fixo"] : dict["variável"]}
            </span>
          ) : null}
          {tx.isCard && !tx.isTransfer ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-warn)]"
              title={dict["Compra no cartão — demonstrativo"]}
            >
              <CreditCard className="size-3" />
              {dict["cartão"]}
            </span>
          ) : null}
          {tx.isCardPayment ? <span className="rounded bg-[var(--color-save-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-brand)]" title={dict["Conta no cash; excluído do accrual"]}>{dict["pagamento de fatura"]}</span> : null}
          {tx.possibleCardPayment ? <span className="muted text-xs" title={dict["Mesmo valor e mês de uma compra no cartão; sugestão sem classificação automática"]}>{dict["possível pagamento de fatura"]}</span> : null}
          {tx.origin && tx.origin !== "MANUAL" && !tx.isCard && tx.accountType !== "INVESTMENT" && tx.kind === "EXPENSE" ? <button type="button" disabled={pending} aria-pressed={Boolean(tx.isCardPayment)} onClick={() => start(async () => { await setTransactionCardPayment(tx.id, !tx.isCardPayment); })} className="min-h-11 min-w-11 cursor-pointer rounded border px-1.5 py-0.5 text-xs text-[var(--text-brand)] hover:bg-[var(--surface-2)]">{tx.isCardPayment ? dict["Desmarcar pagamento"] : dict["Marcar pagamento"]}</button> : null}
          {tx.installmentNumber && tx.installmentTotal ? (
            <span
              className="rounded-[var(--radius-xs)] bg-[var(--color-save-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-brand)]"
              title={dict["Compra parcelada"]}
            >
              {dict["parcela "]}{tx.installmentNumber}/{tx.installmentTotal}
            </span>
          ) : null}
          {tx.recurringRuleId ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs ring-1 ring-[var(--border)] ring-inset"
              title={dict["Gerado por uma recorrência"]}
            >
              <Repeat className="size-3" />
              {dict["recorrente"]}
            </span>
          ) : null}
          {isSplit ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--color-save-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-brand)]"
              title={tx.splits!.map((s) => `${s.name}: ${formatCents(s.amountCents, locale)}`).join(", ")}
            >
              <Users className="size-3" />
              {dict["dividido com "]}{tx.splits!.length}
            </span>
          ) : null}
          <span className="truncate text-xs">{displayName}</span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span
          className={cn(
            "tnum font-mono block text-sm font-semibold",
            valueColorClass,
          )}
        >
          {valueSignal} {formatCents(tx.amountCents, locale)}
        </span>
        {isSplit ? (
          <span
            className="tnum font-mono block text-xs text-[var(--text-muted)]"
            title={dict["Sua parte nesta despesa"]}
          >
            {dict["sua parte: "]}{formatCents(tx.myShareCents ?? tx.amountCents, locale)}
          </span>
        ) : null}
      </div>

      <div className="hidden items-center gap-2 md:flex">{rowActions}</div>

      {splitOpen ? (
        <SplitDialog
          isOpen={splitOpen}
          onClose={() => setSplitOpen(false)}
          transaction={tx}
          initialSplits={tx.splits}
        />
      ) : null}
      {categoryError && <p role="alert" className="w-full text-sm text-[var(--text-out)]">{categoryError}</p>}
      {categoryOpen && <Sheet title={dict["Detalhes do lançamento"]} onClose={() => setCategoryOpen(false)}>
        <p className="mb-3 break-words text-sm">{tx.description}</p>
        <p className={`tnum mb-4 text-display ${valueColorClass}`}>{valueSignal} {formatCents(tx.amountCents, locale)}</p>
        {manualEntry && tx.origin === "MANUAL" && !tx.transferGroupId && <EditTransactionForm transaction={tx} onSaved={() => setCategoryOpen(false)} />}
        {!tx.isTransfer || tx.origin === "PLUGGY" ? <Field label={dict["Categoria"]}>
          <Select value={tx.categoryId ?? ""} disabled={pending} onChange={(e) => chooseCategory(e.target.value)}>
            <option value="">{dict["Sem categoria"]}</option>{options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
        </Field> : <p className="text-sm text-[var(--text-muted)]">{dict["Transferência entre contas."]}</p>}
        {categoryError && <p role="alert" className="mt-3 text-sm text-[var(--text-out)]">{categoryError}</p>}
        <div className="mt-4 flex flex-wrap gap-2" onClickCapture={() => setCategoryOpen(false)}>{rowActions}</div>
        <Button type="button" className="mt-4 min-h-11 w-full" onClick={() => setCategoryOpen(false)}>{dict["Concluir"]}</Button>
      </Sheet>}
    </li>
  );
}

function groupByDate(items: PlainTransaction[]): [string, PlainTransaction[]][] {
  const map = new Map<string, PlainTransaction[]>();
  for (const t of items) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return [...map.entries()];
}
