"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useTransition } from "react";
import { LifeBuoy } from "lucide-react";
import { upsertEmergencyGoal, contributeToGoal } from "@/server/actions/goals";
import { MobileDisclosure } from "@/components/ui/mobile-disclosure";
import { Money } from "@/components/ui/money";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { MoneyInput } from "@/components/ui/field";
import { formatCents } from "@/lib/money";
import { monthsToTarget, monthsOfRunway } from "@/lib/finance";
import { GoalRecurringControl, type PlainGoalRecurringRule } from "./goal-recurring-control";

export function EmergencyPanel({
  target,
  saved,
  months,
  costBase,
  usingRealCost,
  goalId,
  monthlyCapacity,
  recurringRule,
}: {
  target: number;
  saved: number;
  months: number;
  costBase: number;
  usingRealCost: boolean;
  goalId: string | null;
  monthlyCapacity: number;
  recurringRule?: PlainGoalRecurringRule | null;
}) {
  const locale = useLocale();
  const [pending, start] = useTransition();
  const missing = Math.max(0, target - saved);
  const runway = monthsOfRunway(saved, costBase);
  const eta = monthsToTarget(saved, monthlyCapacity, 0, target);
  const done = target > 0 && saved >= target;

  return (
    <Card className="min-w-0">
      <div className="mb-3 flex sm:mb-5 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-save-soft)] text-[var(--color-save)]">
          <LifeBuoy className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">{translatePlanning(locale, "Reserva de emergência")}</h2>
          <p className="muted mt-0.5 text-[0.8125rem] leading-snug">
            {months} {translatePlanning(locale, "meses de custo de vida (")}{formatCents(costBase, locale)}{translatePlanning(locale, "/mês")} {usingRealCost ? translatePlanning(locale, ", média real dos seus gastos") : translatePlanning(locale, ", estimado a partir da renda")}).
          </p>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <Money cents={saved} size="hero" />
        <span className="muted tnum text-[0.875rem]">{translatePlanning(locale, "meta:")} {formatCents(target, locale)}</span>
      </div>
      <Progress
        label={translatePlanning(locale, "Progresso da reserva de emergência")}
        value={target ? (saved / target) * 100 : 0}
        color="var(--color-save)"
        height={6}
      />

      <div className="mt-3"><MobileDisclosure label={translatePlanning(locale, "Detalhes e aportes da reserva")}>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label={translatePlanning(locale, "Falta guardar")} value={formatCents(missing, locale)} />
        <Metric label={translatePlanning(locale, "Meses cobertos hoje")} value={`${runway} de ${months}`} />
        <Metric
          label={translatePlanning(locale, "Previsão no ritmo atual")}
          value={done ? translatePlanning(locale, "Concluída") : eta === null ? "—" : `${eta} ${eta === 1 ? translatePlanning(locale, "mês") : translatePlanning(locale, "meses")}`}
        />
      </div>

      {goalId ? (
        <form
          className="mt-5 flex flex-wrap items-end gap-2"
          action={async (formData) => {
            await contributeToGoal(goalId, formData);
          }}
        >
          <div className="min-w-40 flex-1">
            <label className="mb-1.5 block text-[0.8125rem] font-medium">{translatePlanning(locale, "Registrar aporte")}</label>
            <MoneyInput className="min-h-12 min-w-0 max-w-full text-base!" name="amount" inputMode="decimal" placeholder={translatePlanning(locale, "0,00")} required />
          </div>
          <Button className="min-h-11 min-w-11" type="submit" name="mode" value="add">
            {translatePlanning(locale, "Guardar")} </Button>
          <Button className="min-h-11 min-w-11"
            type="submit"
            name="mode"
            value="withdraw"
            variant="outline"
            formNoValidate={false}
            title={translatePlanning(locale, "Registrar um resgate da reserva")}
          >
            {translatePlanning(locale, "Resgatar")} </Button>
        </form>
      ) : (
        <div className="mt-5">
          <Button className="min-h-11 min-w-11"
            disabled={pending || target <= 0}
            onClick={() => start(async () => void (await upsertEmergencyGoal(target)))}
          >
            {pending ? translatePlanning(locale, "Criando...") : translatePlanning(locale, "Criar minha reserva de emergência")}
          </Button>
          {target <= 0 ? (
            <p className="muted mt-2 text-xs">
              {translatePlanning(locale, "Informe sua renda em Configurações para o sistema calcular a meta.")} </p>
          ) : null}
        </div>
      )}

      {goalId ? <GoalRecurringControl goalId={goalId} rule={recurringRule ?? null} /> : null}

      <div className="mt-5">
        <Hint tone={done ? "good" : "tip"}>
          {done ? (
            <>
              {translatePlanning(locale, "Reserva completa. Mantenha o dinheiro em algo com")} <strong>{translatePlanning(locale, "liquidez diária")}</strong> {translatePlanning(locale, "e direcione os próximos aportes para objetivos de prazo maior.")} </>
          ) : (
            <>
              {translatePlanning(locale, "Reserva de emergência não é investimento: o objetivo é estar disponível")}{" "}
              <strong>{translatePlanning(locale, "no dia em que der problema")}</strong>{translatePlanning(locale, ". Prefira Tesouro Selic ou CDB de liquidez diária — nunca ações ou fundos com carência.")} </>
          )}
        </Hint>
      </div>
      </MobileDisclosure></div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3.5">
      <p className="muted text-xs">{label}</p>
      <p className="tnum break-all mt-0.5 text-[0.9375rem] font-semibold">{value}</p>
    </div>
  );
}
