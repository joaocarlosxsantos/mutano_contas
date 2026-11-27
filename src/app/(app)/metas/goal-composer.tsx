"use client";

import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useActionState, useEffect, useRef, useState } from "react";
import { createGoal, type ActionState } from "@/server/actions/goals";
import { Field, MoneyInput, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { parseMoneyToCents, formatCents } from "@/lib/money";
import { monthlySavingsNeeded } from "@/lib/finance";
import { formatDate } from "@/lib/dates";

import { GOAL_COLORS } from "@/lib/goal-colors";

const initial: ActionState = {};

function localizedKINDS(locale: Locale) { return [
  { value: "PURCHASE", label: translatePlanning(locale, "Compra"), color: GOAL_COLORS[0], ink: "var(--text-info)" },
  { value: "TRIP", label: translatePlanning(locale, "Viagem"), color: GOAL_COLORS[1], ink: "var(--text-warn)" },
  { value: "DEBT_PAYOFF", label: translatePlanning(locale, "Quitar dívida"), color: GOAL_COLORS[2], ink: "var(--text-out)" },
  { value: "INVESTMENT", label: translatePlanning(locale, "Investimento"), color: GOAL_COLORS[3], ink: "var(--text-in)" },
  { value: "CUSTOM", label: translatePlanning(locale, "Outra"), color: GOAL_COLORS[4], ink: "var(--text-muted)" },
]; }


export function GoalComposer() {
  const locale = useLocale();
  const [state, formAction] = useActionState(createGoal, initial);
  const ref = useRef<HTMLFormElement>(null);
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const targetCents = parseMoneyToCents(target);
  const savedCents = parseMoneyToCents(saved);
  const savingsNeeded = targetCents > 0 && targetDate ? monthlySavingsNeeded(targetCents, savedCents, targetDate) : null;

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset controlled fields on successful creation
      setTarget("");
      setSaved("");
      setTargetDate("");
    }
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <Field label={translatePlanning(locale, "Nome da meta")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="name" required placeholder={translatePlanning(locale, "Ex.: Trocar de notebook")} />
      </Field>

      <Field label={translatePlanning(locale, "Tipo")}>
        <Select className="min-h-12 min-w-0 max-w-full text-base!" name="kind" defaultValue="PURCHASE">
          {localizedKINDS(locale).map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid min-w-0 grid-cols-1 items-start gap-3 min-[480px]:grid-cols-2">
        <Field label={translatePlanning(locale, "Valor da meta")}>
          <MoneyInput
            className="min-h-12 min-w-0 max-w-full text-base!"
            name="target"
            inputMode="decimal"
            required
            placeholder={translatePlanning(locale, "0,00")}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field label={translatePlanning(locale, "Já tenho")}>
          <MoneyInput
            className="min-h-12 min-w-0 max-w-full text-base!"
            name="saved"
            inputMode="decimal"
            placeholder={translatePlanning(locale, "0,00")}
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
          />
        </Field>
      </div>

      <Field label={translatePlanning(locale, "Prazo (opcional)")} hint={translatePlanning(locale, "Uma data deixa a meta concreta e mostra se o ritmo dá conta.")}>
        <Input
          className="min-h-12 min-w-0 max-w-full text-base!"
          name="targetDate"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </Field>

      {savingsNeeded !== null && savingsNeeded > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed">
          <span className="font-medium text-[var(--text-brand)]">{translatePlanning(locale, "Quanto guardar por mês:")} </span>
          <strong className="tnum font-semibold text-[var(--text-primary)]">{formatCents(savingsNeeded, locale)}{translatePlanning(locale, "/mês")}</strong>
          <p className="muted mt-1 text-[0.75rem]">
            {translatePlanning(locale, "Para atingir")} {formatCents(targetCents, locale)} {translatePlanning(locale, "até")} {formatDate(targetDate, locale)}{translatePlanning(locale, ", esse é o aporte sugerido.")} </p>
        </div>
      ) : null}

      <Field label={translatePlanning(locale, "Cor")}>
        <div className="flex gap-2">
          {localizedKINDS(locale).map((k) => (
            <label key={k.color} className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
              <input
                type="radio"
                name="color"
                value={k.color}
                aria-label={translatePlanning(locale, "Cor {0}", k.label.toLowerCase())}
                defaultChecked={k.value === "PURCHASE"}
                className="peer sr-only"
              />
              <span
                className="block size-11 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--acento)] ring-offset-2 ring-offset-[var(--surface)] peer-checked:ring-2 peer-checked:ring-[var(--text-muted)]"
                style={{ background: k.ink }}
              />
            </label>
          ))}
        </div>
      </Field>

      <Field label={translatePlanning(locale, "Observação (opcional)")}>
        <Textarea className="min-h-12 min-w-0 max-w-full text-base!" name="note" placeholder={translatePlanning(locale, "Por que essa meta importa para você?")} />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-[var(--color-money-out-soft)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--text-out)]">
          {state.error}
        </p>
      ) : null}

      <SubmitButton className="min-h-11 min-w-11 w-full" pendingLabel={translatePlanning(locale, "Criando...")}>
        {translatePlanning(locale, "Criar meta")} </SubmitButton>
    </form>
  );
}
