"use client";

import { useLocale } from "@/lib/i18n/context";
import { translateError } from "@/lib/i18n/dictionaries";
import { useTranslation } from "@/lib/i18n/use-translation";


import { UsageProfileFields } from "@/components/usage-profile-fields";
import type { UsageProfile } from "@/lib/usage-profile";
import { useActionState, useMemo, useState } from "react";
import { completeOnboarding, type ActionState } from "@/server/actions/settings";
import { skipOnboardingCalibration } from "@/server/actions/onboarding";
import { Field, MoneyInput, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { formatCents, formatCentsPlain, parseMoneyToCents } from "@/lib/money";
import { fiftyThirtyTwenty } from "@/lib/finance";

const initial: ActionState = {};

export function OnboardingForm({
  defaults,
}: {
  defaults: { usageProfile: UsageProfile; income: number; emergencyMonths: number; savingsTargetPct: number };
}) {
  const t = useTranslation();
  const locale = useLocale();

  const [state, formAction, pending] = useActionState(completeOnboarding, initial);
  const [skipState, skipFormAction, skipPending] = useActionState(skipOnboardingCalibration, initial);
  const [income, setIncome] = useState(defaults.income ? formatCentsPlain(defaults.income, locale) : "");
  const [months, setMonths] = useState(String(defaults.emergencyMonths || 6));
  const [savePct, setSavePct] = useState(String(defaults.savingsTargetPct || 20));

  const cents = parseMoneyToCents(income);
  const split = useMemo(() => fiftyThirtyTwenty(cents), [cents]);
  const emergencyEstimate = Math.round(cents * 0.7) * Number(months || 0);
  const monthlySave = Math.round((cents * Number(savePct || 0)) / 100);

  return (
    <form aria-busy={pending} action={formAction} className="space-y-6">
      <UsageProfileFields defaultValue={defaults.usageProfile} />
      <div className="card space-y-3 p-3 sm:space-y-5 sm:p-6 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none">
        <Field className="max-sm:rounded-xl max-sm:border max-sm:bg-[var(--surface)] max-sm:p-3"
          label={t("Renda mensal líquida")}
          hint={t("O que efetivamente cai na sua conta por mês, já com descontos. Se varia, use uma média conservadora.")}
        >
          <MoneyInput className="min-h-12 min-w-0 max-w-full text-base!"
            name="income"
            inputMode="decimal"
            required
            placeholder={t("Ex.: 5.400,00")}
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
        </Field>

        <div className="grid min-w-0 grid-cols-1 items-start gap-3 sm:gap-5 sm:grid-cols-2">
          <Field className="max-sm:rounded-xl max-sm:border max-sm:bg-[var(--surface)] max-sm:p-3"
            label={t("Meses de reserva de emergência")}
            hint={t("CLT estável: 6 meses. Autônomo ou renda variável: 9 a 12.")}
          >
            <Select className="min-h-12 min-w-0 max-w-full text-base!" name="emergencyMonths" value={months} onChange={(e) => setMonths(e.target.value)}>
              {[3, 6, 9, 12].map((m) => (
                <option key={m} value={m}>
                  {m} {t("meses")}</option>
              ))}
            </Select>
          </Field>

          <Field className="max-sm:rounded-xl max-sm:border max-sm:bg-[var(--surface)] max-sm:p-3" label={t("Quanto quero guardar por mês")} hint={t("A referência clássica é 20% da renda.")}>
            <Select className="min-h-12 min-w-0 max-w-full text-base!" name="savingsTargetPct" value={savePct} onChange={(e) => setSavePct(e.target.value)}>
              {[5, 10, 15, 20, 25, 30, 40].map((p) => (
                <option key={p} value={p}>
                  {p}{t("% da renda")}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {cents > 0 ? (
        <div className="card min-w-0 space-y-3 p-3 sm:space-y-4 sm:p-6 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">
            {t("Com essa renda, aqui está o seu ponto de partida")}</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SplitCard label={t("Essenciais (50%)")} value={split.necessitiesCents} color="var(--text-brand)" desc={t("Moradia, contas, mercado, transporte")} />
            <SplitCard label={t("Estilo de vida (30%)")} value={split.wantsCents} color="var(--color-variable)" desc={t("Lazer, assinaturas, extras")} />
            <SplitCard label={t("Futuro (20%)")} value={split.futureCents} color="var(--color-money-in)" desc={t("Reserva, investimentos, quitar dívida")} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 border-t border-[var(--line)] pt-4 max-sm:rounded-xl max-sm:border max-sm:bg-[var(--surface)] max-sm:p-3">
              <p className="muted text-xs">{t("Meta de reserva estimada")}</p>
              <p className="tnum mt-1 max-w-full break-all text-[clamp(1.25rem,4vw,var(--text-display))] font-semibold">{formatCents(emergencyEstimate, locale)}</p>
              <p className="muted mt-1 text-xs leading-snug">
                {t("Estimativa com custo de vida em 70% da renda. Assim que você lançar gastos, o cálculo passa a usar o seu custo real.")}</p>
            </div>
            <div className="min-w-0 border-t border-[var(--line)] pt-4 max-sm:rounded-xl max-sm:border max-sm:bg-[var(--surface)] max-sm:p-3">
              <p className="muted text-xs">{t("Guardando")}{" "}{savePct}{t("% ao mês")}</p>
              <p className="tnum mt-1 max-w-full break-all text-[clamp(1.25rem,4vw,var(--text-display))] font-semibold">{formatCents(monthlySave, locale)}</p>
              <p className="muted mt-1 text-xs leading-snug">
                {t("Nesse ritmo, a reserva completa fica pronta em cerca de")}{" "}
                {monthlySave > 0 ? Math.ceil(emergencyEstimate / monthlySave) : "—"} {" "}{t("meses.")}</p>
            </div>
          </div>


        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-[var(--color-money-out-soft)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--text-out)]">
          {translateError(state.error, locale)}
        </p>
      ) : null}

      <SubmitButton className="min-h-11 min-w-11 w-full sm:w-auto" pendingLabel={t("Preparando seu painel...")}>
        {t("Ir para o painel")}</SubmitButton>
      {skipState.error ? <p role="alert" className="rounded-xl bg-[var(--color-money-out-soft)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--text-out)]">{translateError(skipState.error, locale)}</p> : null}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium text-[var(--text)]">{t("Prefere começar sem informar sua renda?")}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{t("Você pode escolher o modo acima e adiar a calibração. Sua renda e suas preferências atuais são preservadas; ajuste esses dados depois em Configurações.")}</p>
        <button type="submit" formAction={skipFormAction} formNoValidate disabled={pending || skipPending} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[var(--line)] px-3.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50">
          {skipPending ? t("Abrindo seu painel…") : t("Pular calibração por agora")}
        </button>
      </div>
    </form>
  );
}

function SplitCard({
  label,
  value,
  color,
  desc,
}: {
  label: string;
  value: number;
  color: string;
  desc: string;
}) {
  const locale = useLocale();

  return (
    <div className="min-w-0 border-t border-[var(--line)] pt-4 max-sm:rounded-xl max-sm:border max-sm:bg-[var(--surface)] max-sm:p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="tnum break-all text-lg font-semibold">{formatCents(value, locale)}</p>
      <p className="muted mt-1 text-xs leading-snug">{desc}</p>
    </div>
  );
}
