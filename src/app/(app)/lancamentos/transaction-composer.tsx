"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTransaction, type ActionState } from "@/server/actions/transactions";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatCents, parseMoneyToCents } from "@/lib/money";
import { splitInstallments } from "@/lib/installments";
import { todayRef } from "@/lib/dates";
import { useLocale } from "@/lib/i18n/context";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";
import type { PlainAccount, PlainCategory } from "./types";

const initial: ActionState = {};

const PARCELAS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24, 36, 48];

export function TransactionComposer({
  categories,
  accounts,
}: {
  categories: PlainCategory[];
  accounts: PlainAccount[];
}) {
  const locale = useLocale();
  const dict = getActivityDict(locale);
  const [state, formAction] = useActionState(createTransaction, initial);
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [nature, setNature] = useState<"FIXED" | "VARIABLE">("VARIABLE");
  const [installments, setInstallments] = useState(1);
  const [amount, setAmount] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const visible = categories.filter((c) => c.kind === kind);
  const totalCents = parseMoneyToCents(amount);
  const parcelas =
    installments > 1 && totalCents > 0 ? splitInstallments(totalCents, installments) : [];

  // Ajuste de estado durante o render quando a action responde; o reset do DOM fica no efeito.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) {
      setCategoryId("");
      setInstallments(1);
      setAmount("");
    }
  }

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function onCategoryChange(id: string) {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    if (cat) setNature(cat.nature);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-card)] bg-[var(--surface-2)] p-1">
        {(["EXPENSE", "INCOME"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setCategoryId("");
            }}
            className={["min-h-11 min-w-11", cn(
              "cursor-pointer rounded-[var(--radius-button)] py-2 text-[0.8125rem] font-medium transition-colors",
              kind === k
                ? k === "EXPENSE"
                  ? "bg-[var(--btn-out)] text-[var(--on-acento)] shadow-sm"
                  : "bg-[var(--btn-in)] text-[var(--on-acento)] shadow-sm"
                : "hover:bg-[var(--surface)] text-[var(--text-muted)]",
            )].filter(Boolean).join(" ")}
          >
            {k === "EXPENSE" ? dict["Saiu"] : dict["Entrou"]}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="nature" value={nature} />

      <Field label={dict["Descrição"]}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="description" required placeholder={dict["Ex.: Mercado do mês"]} />
      </Field>

      <div className="grid min-w-0 grid-cols-1 items-start gap-3 min-[480px]:grid-cols-2">
        <Field label={installments > 1 ? dict["Valor total (R$)"] : dict["Valor (R$)"]}>
          <Input className="min-h-12 min-w-0 max-w-full text-base!"
            name="amount"
            inputMode="decimal"
            required
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={dict["Data"]}>
          <Input className="min-h-12 min-w-0 max-w-full text-base!" name="date" type="date" required defaultValue={todayRef()} />
        </Field>
      </div>

      <Field label={dict["Categoria"]}>
        <Select className="min-h-12 min-w-0 max-w-full text-base!" name="categoryId" value={categoryId} onChange={(e) => onCategoryChange(e.target.value)}>
          <option value="">{dict["Sem categoria"]}</option>
          {visible.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {kind === "EXPENSE" ? (
        <Field label={dict["Tipo de gasto"]} hint={dict["Compromisso mensal fixo ou gasto variável."]}>
          <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-card)] bg-[var(--surface-2)] p-1">
            {(["FIXED", "VARIABLE"] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNature(n)}
                className={["min-h-11 min-w-11", cn(
                  "cursor-pointer rounded-[var(--radius-button)] py-2 text-[0.8125rem] font-medium transition-colors",
                  nature === n ? "bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]" : "muted",
                )].filter(Boolean).join(" ")}
              >
                {n === "FIXED" ? dict["Fixo"] : dict["Variável"]}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      {kind === "EXPENSE" ? (
        <Field
          label={dict["Parcelamento"]}
          hint={
            installments > 1
              ? dict["Uma parcela por mês."]
              : dict["Para compras parceladas no cartão."]
          }
        >
          <Select className="min-h-12 min-w-0 max-w-full text-base!"
            value={String(installments)}
            onChange={(e) => setInstallments(Number(e.target.value))}
          >
            <option value="1">{dict["À vista"]}</option>
            {PARCELAS.map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </Select>
          {installments > 1 && parcelas.length ? (
            <p className="muted mt-2 text-xs leading-snug">
              {installments}{dict["x de "]}<strong>{formatCents(parcelas[0], locale)}</strong>
              {parcelas[0] !== parcelas[parcelas.length - 1]
                ? `${dict[" (última em "]}${formatCents(parcelas[parcelas.length - 1], locale)})`
                : ""}
              . Total {formatCents(totalCents, locale)}.
            </p>
          ) : null}
        </Field>
      ) : null}
      <input type="hidden" name="installments" value={kind === "EXPENSE" ? installments : 1} />

      <Field label={dict["Conta"]}>
        <Select className="min-h-12 min-w-0 max-w-full text-base!" name="accountId" required defaultValue={accounts[0]?.id ?? ""}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-[var(--radius-input)] bg-[var(--color-money-out-soft)] px-3.5 py-2 text-xs text-[var(--text-out)]">
          {state.error}
        </p>
      ) : null}

      <SubmitButton className="min-h-11 min-w-11 w-full" pendingLabel={dict["Lançando..."]}>
        {installments > 1 && kind === "EXPENSE"
          ? `${dict["Lançar "]}${installments}${dict[" parcelas"]}`
          : dict["Adicionar lançamento"]}
      </SubmitButton>
    </form>
  );
}
