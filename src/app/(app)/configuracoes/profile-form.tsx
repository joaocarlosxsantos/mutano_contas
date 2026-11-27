"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useActionState } from "react";
import { saveProfile, type ActionState } from "@/server/actions/settings";
import { Field, MoneyInput, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";

const initial: ActionState = {};

export function ProfileForm({
  defaults,
}: {
  defaults: { name: string; income: number; emergencyMonths: number; savingsTargetPct: number };
}) {
  const locale = useLocale();
  const [state, formAction] = useActionState(saveProfile, initial);

  return (
    <form action={formAction} className="space-y-4">
      <Field label={translatePlanning(locale, "Nome")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="name" defaultValue={defaults.name} required />
      </Field>

      <Field label={translatePlanning(locale, "Renda mensal líquida")} hint={translatePlanning(locale, "O que cai na conta, já com descontos.")}>
        <MoneyInput className="min-h-12 min-w-0 max-w-full text-base!"
          name="income"
          inputMode="decimal"
          defaultValue={(defaults.income / 100).toFixed(2).replace(".", locale === "en" ? "." : ",")}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={translatePlanning(locale, "Meses de reserva")}>
          <Select className="min-h-12 min-w-0 max-w-full text-base!" name="emergencyMonths" defaultValue={String(defaults.emergencyMonths)}>
            {[3, 6, 9, 12, 18, 24].map((m) => (
              <option key={m} value={m}>
                {m} {translatePlanning(locale, "meses")} </option>
            ))}
          </Select>
        </Field>
        <Field label={translatePlanning(locale, "Meta de economia")}>
          <Select className="min-h-12 min-w-0 max-w-full text-base!" name="savingsTargetPct" defaultValue={String(defaults.savingsTargetPct)}>
            {[5, 10, 15, 20, 25, 30, 40, 50].map((p) => (
              <option key={p} value={p}>
                {p}{translatePlanning(locale, "% da renda")} </option>
            ))}
          </Select>
        </Field>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-[var(--color-money-out-soft)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--text-out)]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-xl bg-[var(--color-money-in-soft)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--text-in)]">
          {translatePlanning(locale, "Perfil atualizado.")} </p>
      ) : null}

      <SubmitButton className="min-h-11 min-w-11">{translatePlanning(locale, "Salvar perfil")}</SubmitButton>
    </form>
  );
}
