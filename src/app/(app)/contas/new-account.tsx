"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createAccount, type ActionState } from "@/server/actions/settings";
import { Sheet, useSheetClose } from "@/components/sheet";
import { Button, SubmitButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useUsageProfile } from "@/components/usage-profile";
import { canUseCapability } from "@/lib/usage-profile";
import { useLocale } from "@/lib/i18n/context";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

export function NewAccount() {
  const profile = useUsageProfile();
  const locale = useLocale();
  const dict = getActivityDict(locale);
  const [open, setOpen] = useState(false);
  if (!canUseCapability(profile, "manual-entry")) return null;
  return <>
    <Button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"><Plus aria-hidden="true" className="mr-2 size-4" />{dict["Criar conta"]}</Button>
    {open && <Sheet title={dict["Criar conta"]} onClose={() => setOpen(false)}><AccountForm /></Sheet>}
  </>;
}

function AccountForm() {
  const locale = useLocale();
  const dict = getActivityDict(locale);
  const close = useSheetClose();
  const [type, setType] = useState("CHECKING");
  const [state, action, pending] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await createAccount(previous, form);
    if (result.ok) close();
    return result;
  }, {});
  return <form action={action} className="space-y-4" aria-busy={pending}>
    <fieldset disabled={pending} className="space-y-4">
      <Field label={dict["Nome"]}><Input name="name" required minLength={2} placeholder={dict["Ex.: Conta principal"]} /></Field>
      <Field label={dict["Tipo"]}><Select name="type" value={type} onChange={(event) => setType(event.target.value)}>
        <option value="CHECKING">{dict["Conta corrente"]}</option>
        <option value="SAVINGS">{dict["Poupança"]}</option>
        <option value="CREDIT_CARD">{dict["Cartão de crédito"]}</option>
        <option value="CASH">{dict["Dinheiro"]}</option>
        <option value="INVESTMENT">{dict["Investimento"]}</option>
      </Select></Field>
      <Field label={dict["Instituição (opcional)"]}><Input name="institution" /></Field>
      {type === "CREDIT_CARD" && <div className="grid grid-cols-2 gap-3">
        <Field label={dict["Dia do fechamento"]}><Input name="closingDay" type="number" min={1} max={31} /></Field>
        <Field label={dict["Dia do vencimento"]}><Input name="dueDay" type="number" min={1} max={31} /></Field>
      </div>}
    </fieldset>
    {state.error && <p role="alert" className="text-sm text-[var(--text-out)]">{state.error}</p>}
    <SubmitButton pendingLabel={dict["Criando…"]}>{dict["Criar conta"]}</SubmitButton>
  </form>;
}
