"use client";

import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArchiveRestore, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import {
  createAccount,
  deleteAccount,
  deleteAccountPermanently,
  restoreAccount,
  updateAccount,
  type ActionState,
} from "@/server/actions/settings";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { Button, SubmitButton } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

const initial: ActionState = {};

function localizedTYPE_LABEL(locale: Locale): Record<string, string> { return {
  CHECKING: translatePlanning(locale, "Conta corrente"),
  SAVINGS: translatePlanning(locale, "Poupança"),
  CREDIT_CARD: translatePlanning(locale, "Cartão de crédito"),
  CASH: translatePlanning(locale, "Dinheiro"),
  INVESTMENT: translatePlanning(locale, "Investimento"),
}; }


type Account = {
  id: string;
  name: string;
  type: string;
  color: string;
  institution: string | null;
  archived: boolean;
  transactionCount: number;
  recurringCount: number;
  closingDay?: number | null;
  dueDay?: number | null;
};

export function AccountsPanel({ accounts }: { accounts: Account[] }) {
  const locale = useLocale();
  const [state, formAction] = useActionState(createAccount, initial);
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState("CHECKING");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
// eslint-disable-next-line react-hooks/set-state-in-effect -- On successful account creation, reset the native form and close its dialog.
      setOpen(false);
    }
  }, [state]);

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  const toggleEdit = (id: string) => setEditingId((current) => (current === id ? null : id));

  async function archive(a: Account) {
    const ok = await confirm({
      title: translatePlanning(locale, "Arquivar a conta \"{0}\"?", a.name),
      description: translatePlanning(locale, "Os lançamentos continuam salvos. A conta some das telas de lançar e importar, mas fica listada aqui."),
      confirmLabel: translatePlanning(locale, "Arquivar"),
      tone: "danger",
    });
    if (!ok) return;
    start(async () => void (await deleteAccount(a.id)));
  }

  async function removeForever(a: Account) {
    const pieces = [
      a.transactionCount > 0 ? translatePlanning(locale, "{0} lançamento(s)", a.transactionCount) : null,
      a.recurringCount > 0 ? translatePlanning(locale, "{0} recorrência(s)", a.recurringCount) : null,
    ].filter(Boolean);
    const description =
      pieces.length > 0
        ? translatePlanning(locale, "Isso apaga a conta e {0} dela para sempre. Não tem como desfazer.", pieces.join(" e "))
        : translatePlanning(locale, "Essa conta não tem lançamentos. A exclusão não tem como ser desfeita.");
    const ok = await confirm({
      title: translatePlanning(locale, "Excluir \"{0}\" definitivamente?", a.name),
      description,
      confirmLabel: translatePlanning(locale, "Excluir para sempre"),
      tone: "danger",
    });
    if (!ok) return;
    start(async () => void (await deleteAccountPermanently(a.id)));
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y rounded-xl border">
        {active.map((a) => (
          <li key={a.id} className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-medium">{a.name}</p>
                <p className="muted truncate text-xs">
                  {localizedTYPE_LABEL(locale)[a.type] ?? a.type}
                  {a.institution ? ` · ${a.institution}` : ""}
                  {a.type === "CREDIT_CARD" && a.closingDay && a.dueDay
                    ? translatePlanning(locale, " · Fecha dia {0}, vence dia {1}", a.closingDay, a.dueDay)
                    : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label={translatePlanning(locale, "Editar {0}", a.name)}
                onClick={() => toggleEdit(a.id)}
                className="inline-flex items-center justify-center min-h-11 min-w-11 muted cursor-pointer rounded-lg p-2.5 hover:bg-[var(--surface-2)] hover:text-[var(--text-brand)]"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={translatePlanning(locale, "Arquivar {0}", a.name)}
                onClick={() => void archive(a)}
                className="inline-flex items-center justify-center min-h-11 min-w-11 muted cursor-pointer rounded-lg p-2.5 hover:bg-[var(--color-money-out-soft)] hover:text-[var(--text-out)]"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            {editingId === a.id ? (
              <EditForm account={a} onDone={() => toggleEdit(a.id)} />
            ) : null}
          </li>
        ))}
        {!active.length ? (
          <li>
            <EmptyState
              icon={Wallet}
              title={translatePlanning(locale, "Nenhuma conta cadastrada")}
              description={translatePlanning(locale, "Toda movimentação precisa estar em uma conta. Crie a primeira abaixo — pode ser sua conta corrente, um cartão ou até dinheiro em espécie.")}
            />
          </li>
        ) : null}
      </ul>

      {archived.length ? (
        <div>
          <h3 className="muted mb-2 text-xs font-semibold tracking-wide uppercase">
            {translatePlanning(locale, "Arquivadas")} </h3>
          <ul className="divide-y rounded-xl border border-dashed bg-[var(--surface-2)]">
            {archived.map((a) => (
              <li key={a.id} className="px-4 py-2.5 opacity-70">
                <div className="flex items-center gap-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.875rem] font-medium">
                      {a.name}
                      <span className="muted ml-2 text-xs font-normal">{translatePlanning(locale, "arquivada")}</span>
                    </p>
                    <p className="muted truncate text-xs">
                      {localizedTYPE_LABEL(locale)[a.type] ?? a.type}
                      {a.institution ? ` · ${a.institution}` : ""}
                      {a.type === "CREDIT_CARD" && a.closingDay && a.dueDay
                        ? translatePlanning(locale, " · Fecha dia {0}, vence dia {1}", a.closingDay, a.dueDay)
                        : ""}
                      {translatePlanning(locale, " · {0} lançamento(s)", a.transactionCount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={translatePlanning(locale, "Editar {0}", a.name)}
                    onClick={() => toggleEdit(a.id)}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 muted cursor-pointer rounded-lg p-2.5 hover:bg-[var(--surface)] hover:text-[var(--text-brand)]"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={translatePlanning(locale, "Reativar {0}", a.name)}
                    onClick={() => start(async () => void (await restoreAccount(a.id)))}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 muted cursor-pointer rounded-lg p-2.5 hover:bg-[var(--color-money-in-soft)] hover:text-[var(--text-in)]"
                  >
                    <ArchiveRestore className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={translatePlanning(locale, "Excluir {0} definitivamente", a.name)}
                    onClick={() => void removeForever(a)}
                    className="inline-flex items-center justify-center min-h-11 min-w-11 muted cursor-pointer rounded-lg p-2.5 hover:bg-[var(--color-money-out-soft)] hover:text-[var(--text-out)]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {editingId === a.id ? (
                  <EditForm account={a} onDone={() => toggleEdit(a.id)} />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open ? (
        <form ref={ref} action={formAction} className="space-y-3 rounded-xl border bg-[var(--surface-2)] p-4">
          <Field label={translatePlanning(locale, "Nome")}>
            <Input className="min-h-12 min-w-0 max-w-full text-base!" name="name" required placeholder={translatePlanning(locale, "Ex.: Nubank")} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={translatePlanning(locale, "Tipo")}>
              <Select className="min-h-12 min-w-0 max-w-full text-base!" name="type" defaultValue="CHECKING" onChange={(e) => setNewType(e.target.value)}>
                <option value="CHECKING">{translatePlanning(locale, "Conta corrente")}</option>
                <option value="SAVINGS">{translatePlanning(locale, "Poupança")}</option>
                <option value="CREDIT_CARD">{translatePlanning(locale, "Cartão de crédito")}</option>
                <option value="CASH">{translatePlanning(locale, "Dinheiro")}</option>
                <option value="INVESTMENT">{translatePlanning(locale, "Investimento")}</option>
              </Select>
            </Field>
            <Field label={translatePlanning(locale, "Instituição (opcional)")}>
              <Input className="min-h-12 min-w-0 max-w-full text-base!" name="institution" placeholder={translatePlanning(locale, "Ex.: Banco Inter")} />
            </Field>
          </div>
          {newType === "CREDIT_CARD" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={translatePlanning(locale, "Dia de fechamento")}>
                <Input className="min-h-12 min-w-0 max-w-full text-base!" name="closingDay" type="number" min={1} max={31} placeholder={translatePlanning(locale, "Ex.: 25")} />
              </Field>
              <Field label={translatePlanning(locale, "Dia de vencimento")}>
                <Input className="min-h-12 min-w-0 max-w-full text-base!" name="dueDay" type="number" min={1} max={31} placeholder={translatePlanning(locale, "Ex.: 5")} />
              </Field>
            </div>
          )}
          {state.error ? <p className="text-[0.8125rem] text-[var(--text-out)]">{state.error}</p> : null}
          <div className="flex gap-2">
            <SubmitButton className="min-h-11 min-w-11" size="sm">{translatePlanning(locale, "Adicionar conta")}</SubmitButton>
            <Button className="min-h-11 min-w-11" type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {translatePlanning(locale, "Cancelar")} </Button>
          </div>
        </form>
      ) : (
        <Button className="min-h-11 min-w-11" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {translatePlanning(locale, "Nova conta")} </Button>
      )}
    </div>
  );
}

function EditForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const locale = useLocale();
  const [state, formAction] = useActionState(updateAccount, initial);
  const [type, setType] = useState(account.type);
  const doneRef = useRef(onDone);
// eslint-disable-next-line react-hooks/refs -- Keep the latest callback without retriggering the success effect when its identity changes.
  doneRef.current = onDone;

  useEffect(() => {
    if (state.ok) doneRef.current();
  }, [state]);

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-xl border bg-[var(--surface-2)] p-3">
      <input type="hidden" name="id" value={account.id} />
      <Field label={translatePlanning(locale, "Nome")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="name" required defaultValue={account.name} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={translatePlanning(locale, "Tipo")}>
          <Select className="min-h-12 min-w-0 max-w-full text-base!" name="type" defaultValue={account.type} onChange={(e) => setType(e.target.value)}>
            <option value="CHECKING">{translatePlanning(locale, "Conta corrente")}</option>
            <option value="SAVINGS">{translatePlanning(locale, "Poupança")}</option>
            <option value="CREDIT_CARD">{translatePlanning(locale, "Cartão de crédito")}</option>
            <option value="CASH">{translatePlanning(locale, "Dinheiro")}</option>
            <option value="INVESTMENT">{translatePlanning(locale, "Investimento")}</option>
          </Select>
        </Field>
        <Field label={translatePlanning(locale, "Instituição (opcional)")}>
          <Input className="min-h-12 min-w-0 max-w-full text-base!" name="institution" defaultValue={account.institution ?? ""} placeholder={translatePlanning(locale, "Ex.: Banco Inter")} />
        </Field>
      </div>
      {type === "CREDIT_CARD" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={translatePlanning(locale, "Dia de fechamento")}>
            <Input className="min-h-12 min-w-0 max-w-full text-base!"
              name="closingDay"
              type="number"
              min={1}
              max={31}
              defaultValue={account.closingDay ?? ""}
              placeholder={translatePlanning(locale, "Ex.: 25")}
            />
          </Field>
          <Field label={translatePlanning(locale, "Dia de vencimento")}>
            <Input className="min-h-12 min-w-0 max-w-full text-base!"
              name="dueDay"
              type="number"
              min={1}
              max={31}
              defaultValue={account.dueDay ?? ""}
              placeholder={translatePlanning(locale, "Ex.: 5")}
            />
          </Field>
        </div>
      )}
      <Field label={translatePlanning(locale, "Cor")}>
        <Input name="color" type="color" defaultValue={account.color} className="h-11 w-24 p-1" />
      </Field>
      {state.error ? <p className="text-[0.8125rem] text-[var(--text-out)]">{state.error}</p> : null}
      <div className="flex gap-2">
        <SubmitButton className="min-h-11 min-w-11" size="sm">{translatePlanning(locale, "Salvar")}</SubmitButton>
        <Button className="min-h-11 min-w-11" type="button" size="sm" variant="ghost" onClick={onDone}>
          {translatePlanning(locale, "Cancelar")} </Button>
      </div>
    </form>
  );
}
