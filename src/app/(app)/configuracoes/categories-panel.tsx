"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory, updateCategory, type ActionState } from "@/server/actions/settings";
import { Field, Input, Select } from "@/components/ui/field";
import { Button, SubmitButton } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CATEGORY_PALETTE } from "@/components/charts/palette";

const initial: ActionState = {};

type Cat = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  nature: "FIXED" | "VARIABLE";
  color: string;
  keywords: string[];
};

export function CategoriesPanel({ categories }: { categories: Cat[] }) {
  const locale = useLocale();
  const [state, formAction] = useActionState(createCategory, initial);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();

  async function remove(id: string, name: string) {
    const ok = await confirm({
      title: translatePlanning(locale, "Arquivar a categoria \"{0}\"?", name),
      description: translatePlanning(locale, "Os lançamentos existentes continuam salvos."),
      confirmLabel: translatePlanning(locale, "Arquivar"),
      tone: "danger",
    });
    if (!ok) return;
    start(async () => void (await deleteCategory(id)));
  }

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
// eslint-disable-next-line react-hooks/set-state-in-effect -- On successful category creation, reset the native form and close its dialog.
      setOpen(false);
    }
  }, [state]);

  const income = categories.filter((c) => c.kind === "INCOME");
  const expense = categories.filter((c) => c.kind === "EXPENSE");

  const toggleEdit = (id: string) => setEditingId((current) => (current === id ? null : id));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Group
          title={translatePlanning(locale, "Entradas")}
          items={income}
          editingId={editingId}
          onDelete={(id, name) => void remove(id, name)}
          onToggleEdit={toggleEdit}
        />
        <Group
          title={translatePlanning(locale, "Saídas")}
          items={expense}
          editingId={editingId}
          onDelete={(id, name) => void remove(id, name)}
          onToggleEdit={toggleEdit}
        />
      </div>

      {open ? (
        <form ref={ref} action={formAction} className="space-y-3 rounded-xl border bg-[var(--surface-2)] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={translatePlanning(locale, "Nome")}>
              <Input className="min-h-12 min-w-0 max-w-full text-base!" name="name" required placeholder={translatePlanning(locale, "Ex.: Pet")} />
            </Field>
            <Field label={translatePlanning(locale, "Tipo")}>
              <Select className="min-h-12 min-w-0 max-w-full text-base!" name="kind" defaultValue="EXPENSE">
                <option value="EXPENSE">{translatePlanning(locale, "Saída")}</option>
                <option value="INCOME">{translatePlanning(locale, "Entrada")}</option>
              </Select>
            </Field>
            <Field label={translatePlanning(locale, "Natureza")}>
              <Select className="min-h-12 min-w-0 max-w-full text-base!" name="nature" defaultValue="VARIABLE">
                <option value="VARIABLE">{translatePlanning(locale, "Variável")}</option>
                <option value="FIXED">{translatePlanning(locale, "Fixo")}</option>
              </Select>
            </Field>
          </div>
          <Field
            label={translatePlanning(locale, "Palavras-chave")}
            hint={translatePlanning(locale, "Usadas para categorizar automaticamente na importação. Ex.: petz, cobasi, ração")}
          >
            <Input className="min-h-12 min-w-0 max-w-full text-base!" name="keywords" placeholder="petz, cobasi, racao" />
          </Field>
          <Field label={translatePlanning(locale, "Cor")}>
            <Input name="color" type="color" defaultValue={CATEGORY_PALETTE[9]} className="h-11 w-24 p-1" />
          </Field>
          {state.error ? <p className="text-[0.8125rem] text-[var(--text-out)]">{state.error}</p> : null}
          <div className="flex gap-2">
            <SubmitButton className="min-h-11 min-w-11" size="sm">{translatePlanning(locale, "Adicionar categoria")}</SubmitButton>
            <Button className="min-h-11 min-w-11" type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {translatePlanning(locale, "Cancelar")} </Button>
          </div>
        </form>
      ) : (
        <Button className="min-h-11 min-w-11" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {translatePlanning(locale, "Nova categoria")} </Button>
      )}
    </div>
  );
}

function Group({
  title,
  items,
  editingId,
  onDelete,
  onToggleEdit,
}: {
  title: string;
  items: Cat[];
  editingId: string | null;
  onDelete: (id: string, name: string) => void;
  onToggleEdit: (id: string) => void;
}) {
  const locale = useLocale();
  return (
    <div>
      <h3 className="muted mb-2 text-xs font-semibold tracking-wide uppercase">{title}</h3>
      <ul className="divide-y rounded-xl border">
        {items.map((c) => (
          <li key={c.id} className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
              <div className="min-w-0 flex-1">
                <p title={c.name} className="break-words text-[0.875rem] font-medium [overflow-wrap:anywhere]">
                  {c.name}
                  {c.kind === "EXPENSE" ? (
                    <span className="muted block text-xs font-normal">
                      {c.nature === "FIXED" ? "fixo" : translatePlanning(locale, "variável")}
                    </span>
                  ) : null}
                </p>
                {c.keywords.length ? (
                  <p title={c.keywords.join(", ")} className="muted break-words text-xs [overflow-wrap:anywhere]">{c.keywords.slice(0, 6).join(", ")}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={translatePlanning(locale, "Editar {0}", c.name)}
                onClick={() => onToggleEdit(c.id)}
                className="inline-flex items-center justify-center min-h-11 min-w-11 muted cursor-pointer rounded-lg p-2.5 hover:bg-[var(--surface-2)] hover:text-[var(--text-brand)]"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={translatePlanning(locale, "Arquivar {0}", c.name)}
                onClick={() => onDelete(c.id, c.name)}
                className="inline-flex items-center justify-center min-h-11 min-w-11 muted cursor-pointer rounded-lg p-2.5 hover:bg-[var(--color-money-out-soft)] hover:text-[var(--text-out)]"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            {editingId === c.id ? (
              <EditForm category={c} onDone={() => onToggleEdit(c.id)} />
            ) : null}
          </li>
        ))}
        {!items.length ? (
          <li className="muted px-4 py-5 text-center text-[0.8125rem]">{translatePlanning(locale, "Nada aqui ainda.")}</li>
        ) : null}
      </ul>
    </div>
  );
}

function EditForm({ category, onDone }: { category: Cat; onDone: () => void }) {
  const locale = useLocale();
  const [state, formAction] = useActionState(updateCategory, initial);
  const doneRef = useRef(onDone);
// eslint-disable-next-line react-hooks/refs -- Keep the latest callback without retriggering the success effect when its identity changes.
  doneRef.current = onDone;

  useEffect(() => {
    if (state.ok) doneRef.current();
  }, [state]);

  return (
    <form
      action={formAction}
      className="mt-3 space-y-3 rounded-xl border bg-[var(--surface-2)] p-3"
    >
      <input type="hidden" name="id" value={category.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={translatePlanning(locale, "Nome")}>
          <Input className="min-h-12 min-w-0 max-w-full text-base!" name="name" required defaultValue={category.name} />
        </Field>
        <Field label={translatePlanning(locale, "Tipo")}>
          <Select className="min-h-12 min-w-0 max-w-full text-base!" name="kind" defaultValue={category.kind}>
            <option value="EXPENSE">{translatePlanning(locale, "Saída")}</option>
            <option value="INCOME">{translatePlanning(locale, "Entrada")}</option>
          </Select>
        </Field>
        <Field label={translatePlanning(locale, "Natureza")}>
          <Select className="min-h-12 min-w-0 max-w-full text-base!" name="nature" defaultValue={category.nature}>
            <option value="VARIABLE">{translatePlanning(locale, "Variável")}</option>
            <option value="FIXED">{translatePlanning(locale, "Fixo")}</option>
          </Select>
        </Field>
      </div>
      <Field
        label={translatePlanning(locale, "Palavras-chave")}
        hint={translatePlanning(locale, "Usadas para categorizar automaticamente na importação. Ex.: petz, cobasi, ração")}
      >
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="keywords" defaultValue={category.keywords.join(", ")} placeholder="petz, cobasi, racao" />
      </Field>
      <Field label={translatePlanning(locale, "Cor")}>
        <Input name="color" type="color" defaultValue={category.color} className="h-11 w-24 p-1" />
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
