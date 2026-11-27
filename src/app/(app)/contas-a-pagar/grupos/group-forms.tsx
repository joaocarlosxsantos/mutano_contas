"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sheet, useSheetClose } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatCents, formatCentsPlain, MAX_CENTS } from "@/lib/money";
import type { GroupPayment } from "@/lib/shared-balances";
import { addSharedExpense, createSharedGroup, recordSharedSettlement, type GroupActionResult } from "@/server/actions/shared-groups";

type Member = { id: string; name: string };

function centsFromForm(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{1,8}(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function ActionForm({ children, submit, run, navigate }: {
  children: ReactNode;
  submit: string;
  run: (form: FormData) => Promise<GroupActionResult>;
  navigate?: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const close = useSheetClose();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setError("");
    start(async () => {
      try {
        const result = await run(form);
        if (!result.ok) { setError(result.error); return; }
        if (navigate) router.push(`/contas-a-pagar/grupos/${result.groupId}`);
        else close();
      } catch {
        setError(translatePlanning(locale, "Não foi possível confirmar o registro. Confira o grupo antes de tentar novamente."));
      }
    });
  }
  return <form onSubmit={submitForm} aria-busy={pending} className="space-y-4">
    <fieldset disabled={pending} className="min-w-0 space-y-4">{children}</fieldset>
    {error && <p role="alert" className="text-sm text-[var(--text-out)]">{error}</p>}
    <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? translatePlanning(locale, "Salvando…") : submit}</Button>
  </form>;
}

export function CreateSharedGroup() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" className="min-h-11" aria-haspopup="dialog" onClick={() => setOpen(true)}>{translatePlanning(locale, "Criar grupo")}</Button>
    {open && <Sheet title={translatePlanning(locale, "Criar grupo")} onClose={() => setOpen(false)}>
      <ActionForm submit={translatePlanning(locale, "Criar grupo")} navigate run={(form) => createSharedGroup({
        name: form.get("name"),
        members: String(form.get("members") ?? "").split(/\r?\n/).map((name) => name.trim()).filter(Boolean),
      })}>
        <Field label={translatePlanning(locale, "Nome do grupo")}><Input name="name" data-autofocus required minLength={2} maxLength={100} placeholder={translatePlanning(locale, "Ex.: Casa")} /></Field>
        <Field label={translatePlanning(locale, "Participantes")} hint={translatePlanning(locale, "Um nome por linha. Inclua seu nome se você participa do grupo.")}>
          <Textarea name="members" required maxLength={2020} rows={4} placeholder={translatePlanning(locale, "Ana\nRui")} />
        </Field>
      </ActionForm>
    </Sheet>}
  </>;
}

export function AddSharedExpense({ groupId, members }: { groupId: string; members: Member[] }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" className="min-h-11" aria-haspopup="dialog" onClick={() => setOpen(true)}>{translatePlanning(locale, "Nova despesa")}</Button>
    {open && <Sheet title={translatePlanning(locale, "Nova despesa")} maxWidth="xl" onClose={() => setOpen(false)}>
      <ExpenseForm groupId={groupId} members={members} />
    </Sheet>}
  </>;
}

function ExpenseForm({ groupId, members }: { groupId: string; members: Member[] }) {
  const locale = useLocale();
  const [mode, setMode] = useState("EQUAL");
  const [included, setIncluded] = useState(() => new Set(members.map((member) => member.id)));
  return <ActionForm submit={translatePlanning(locale, "Registrar despesa")} run={(form) => addSharedExpense({
    groupId,
    payerId: form.get("payerId"),
    description: form.get("description"),
    amountCents: centsFromForm(form.get("amount")),
    mode: form.get("mode"),
    members: form.getAll("memberId").map((memberId) => mode === "VALUE"
      ? { memberId, amountCents: centsFromForm(form.get(`share-${memberId}`)) }
      : { memberId }),
  })}>
    <Field label={translatePlanning(locale, "Descrição")}><Input name="description" required data-autofocus minLength={2} maxLength={255} placeholder={translatePlanning(locale, "Ex.: Compra do mês")} /></Field>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={translatePlanning(locale, "Total em R$")}><Input name="amount" required inputMode="decimal" placeholder={translatePlanning(locale, "0,00")} /></Field>
      <Field label={translatePlanning(locale, "Quem pagou")}><Select name="payerId" required defaultValue=""><option value="" disabled>{translatePlanning(locale, "Selecione")}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></Field>
    </div>
    <Field label={translatePlanning(locale, "Divisão")}><Select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="EQUAL">{translatePlanning(locale, "Partes iguais")}</option><option value="VALUE">{translatePlanning(locale, "Valores por pessoa")}</option>
    </Select></Field>
    <fieldset className="space-y-2"><legend className="text-sm font-medium">{translatePlanning(locale, "Quem divide a despesa")}</legend>
      {members.map((member) => <div key={member.id} className="min-w-0 rounded-xl border border-[var(--line)] px-3 pb-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" name="memberId" value={member.id} checked={included.has(member.id)}
            onChange={(event) => {
              const checked = event.target.checked;
              setIncluded((current) => {
                const next = new Set(current);
                if (checked) next.add(member.id); else next.delete(member.id);
                return next;
              });
            }} />
          <span className="min-w-0 break-words">{member.name}</span>
        </label>
        {mode === "VALUE" && included.has(member.id) && <Field label={translatePlanning(locale, "Parte de {0} em R$", member.name)}>
          <Input name={`share-${member.id}`} required inputMode="decimal" placeholder={translatePlanning(locale, "0,00")} />
        </Field>}
      </div>)}
    </fieldset>
  </ActionForm>;
}

export function RecordSettlement({ groupId, debt, from, to }: { groupId: string; debt: GroupPayment; from: string; to: string }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="outline" className="min-h-11" aria-haspopup="dialog" onClick={() => setOpen(true)}>{translatePlanning(locale, "Registrar acerto")}</Button>
    {open && <Sheet title={translatePlanning(locale, "Registrar acerto")} onClose={() => setOpen(false)}>
      <ActionForm submit={translatePlanning(locale, "Salvar acerto")} run={(form) => recordSharedSettlement({
        groupId, fromId: debt.fromId, toId: debt.toId, amountCents: centsFromForm(form.get("amount")),
      })}>
        <p className="break-words text-sm">{from} {translatePlanning(locale, "paga a")} {to}{translatePlanning(locale, ". Saldo em aberto de")} {formatCents(debt.amountCents, locale)}.</p>
        <Field label={translatePlanning(locale, "Valor pago em R$")}><Input name="amount" required inputMode="decimal" data-autofocus defaultValue={formatCentsPlain(Math.min(debt.amountCents, MAX_CENTS), locale)} /></Field>
      </ActionForm>
    </Sheet>}
  </>;
}
