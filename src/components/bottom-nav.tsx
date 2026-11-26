"use client";

import { useLocale } from "@/lib/i18n/context";
import { translateError } from "@/lib/i18n/dictionaries";
import { useTranslation } from "@/lib/i18n/use-translation";


import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Sheet, useSheetClose } from "@/components/sheet";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { createTransaction, createTransfer, type ActionState } from "@/server/actions/transactions";
import { UserMenuFooter } from "@/components/user-menu-footer";
import { NavigationSections } from "@/components/navigation-sections";
import { getNavigationSections, getPrimaryDestinations, isDestinationActive } from "@/components/navigation-model";
import { useUsageProfile } from "@/components/usage-profile";
import { canUseCapability } from "@/lib/usage-profile";
import { todayRef } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { PlainAccount, PlainCategory } from "@/app/(app)/lancamentos/types";

export function BottomNav({ onNew, userName }: { onNew: () => void; userName: string }) {
  const t = useTranslation();
  const locale = useLocale();

  const pathname = usePathname();
  const profile = useUsageProfile();
  const manualEntry = canUseCapability(profile, "manual-entry");
  const primaryDestinations = getPrimaryDestinations(locale);
  const sections = getNavigationSections(profile, "more", locale);
  const destinations = sections.flatMap((section) => section.items);
  const [moreOpen, setMoreOpen] = useState(false);
  const itemClass = "relative flex min-h-12 min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] sm:text-xs font-medium tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]";
  function destination(item: ReturnType<typeof getPrimaryDestinations>[number]) {
    const active = isDestinationActive(pathname, item.href);
    return <Link key={item.href} href={item.href} aria-label={item.label} title={item.label} aria-current={active ? "page" : undefined}
      className={cn(itemClass, active ? "text-[var(--text)] before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-[var(--acento)]" : "text-[var(--text-subtle)]")}>
      <item.icon aria-hidden="true" className="size-6" strokeWidth={1.5} /><span className="w-full min-w-0 truncate text-center px-0.5">{item.label}</span>
    </Link>;
  }
  return <>
    {/* Keep the standard property alongside the glass recipe's WebKit alias. */}
    <nav aria-label={t("Navegação principal mobile")} style={{ backdropFilter: "blur(20px) saturate(140%)", borderWidth: "1px 0 0" }} className={cn("glass fixed inset-x-0 bottom-0 z-30 grid gap-2 px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden", manualEntry ? "grid-cols-5" : "grid-cols-4")}>
      {primaryDestinations.slice(0, 2).map(destination)}
      {manualEntry && <button type="button" aria-label={t("Novo lançamento")} aria-haspopup="dialog" onClick={onNew}
        className={cn(itemClass, "cursor-pointer bg-[var(--acento)] text-[var(--on-acento)]")}>
        <Plus aria-hidden="true" className="size-6" strokeWidth={1.5} /><span>{t("Lançar")}</span>
      </button>}
      {destination(primaryDestinations[2])}
      <button type="button" aria-label={t("Mais opções")} aria-haspopup="dialog" aria-expanded={moreOpen}
        onClick={() => setMoreOpen(true)} className={cn(itemClass, "cursor-pointer", (isDestinationActive(pathname, "/usuario") || destinations.some((item) => isDestinationActive(pathname, item.href))) ? "text-[var(--text)] before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-[var(--acento)]" : "text-[var(--text-subtle)]")}>
        <MoreHorizontal aria-hidden="true" className="size-6" strokeWidth={1.5} />{t("Mais")}</button>
    </nav>
    {moreOpen && <Sheet title={t("Mais")} onClose={() => setMoreOpen(false)}>
      <nav aria-label={t("Mais destinos")} className="grid grid-cols-1 gap-2">
        <NavigationSections sections={sections} pathname={pathname} surface="more" onNavigate={() => setMoreOpen(false)} />
      </nav>
      <UserMenuFooter userName={userName} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
    </Sheet>}
  </>;
}

type QuickEntryProps = {
  accounts: PlainAccount[]; categories: PlainCategory[]; onClose: () => void;
};

export function QuickEntry(props: QuickEntryProps) {
  const t = useTranslation();

  const profile = useUsageProfile();
  if (!canUseCapability(profile, "manual-entry")) return null;
  return <Sheet title={t("Novo lançamento")} onClose={props.onClose}><QuickEntryForm {...props} /></Sheet>;
}

function QuickEntryForm({ accounts, categories, onClose }: QuickEntryProps) {
  const t = useTranslation();
  const locale = useLocale();

  const closeSheet = useSheetClose();
  const router = useRouter();
  const [kind, setKind] = useState("EXPENSE");
  const [state, action, pending] = useActionState(async (_previous: ActionState, form: FormData): Promise<ActionState> => {
    try {
      const result = kind === "TRANSFER"
        ? await createTransfer(String(form.get("accountId")), String(form.get("toAccountId")), parseMoneyToCents(String(form.get("amount"))), String(form.get("date")), String(form.get("description")))
        : await createTransaction({}, form);
      if (result.ok) { router.refresh(); closeSheet(); }
      return result;
    } catch { return { error: t("Não foi possível salvar. Tente novamente.") }; }
  }, {});
  return <>
    {!accounts.length ? <p className="py-4 text-sm">{t("Cadastre uma conta em")}{" "}<Link href="/contas" replace onClick={onClose} className="underline">{t("Configurações")}</Link>{" "}{t("antes de lançar.")}</p> :
      <form action={action} className="space-y-4 pb-2">
        <fieldset disabled={pending} className="grid grid-cols-3 gap-2">
          <legend className="sr-only">{t("Tipo de lançamento")}</legend>
          {[["EXPENSE", t("Saída")], ["INCOME", t("Entrada")], ["TRANSFER", t("Transferência")]].map(([value, label]) =>
            <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}
              className={cn("min-h-11 min-w-0 cursor-pointer rounded-xl border px-1 text-xs", kind === value ? "border-[var(--acento)] bg-[var(--surface-2)]" : "border-[var(--line-strong)]")}>{label}</button>)}
        </fieldset>
        <input type="hidden" name="kind" value={kind} />
        <Field label={t("Descrição")}><Input name="description" required minLength={2} placeholder={t("Ex.: Mercado")} /></Field>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("Valor (R$)")}><Input name="amount" inputMode="decimal" required placeholder={t("0,00")} className="tnum" /></Field>
          <Field label={t("Data")}><Input name="date" type="date" required defaultValue={todayRef()} /></Field>
        </div>
        <Field label={kind === "TRANSFER" ? t("Conta de origem") : t("Conta")}><Select name="accountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
        {kind === "TRANSFER" ?
          <Field label={t("Conta de destino")}><Select name="toAccountId" required defaultValue={accounts[1]?.id ?? ""}><option value="" disabled>{t("Selecione a conta")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field> : <>
            <Field label={t("Categoria")}><Select key={kind} name="categoryId"><option value="">{t("Sem categoria")}</option>{categories.filter((category) => category.kind === kind).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
            <Field label={t("Tipo de gasto")}><Select name="nature"><option value="VARIABLE">{t("Variável")}</option><option value="FIXED">{t("Fixo")}</option></Select></Field>
          </>}
        {state.error && <p role="alert" className="text-sm text-[var(--text-out)]">{translateError(state.error, locale)}</p>}
        <div className="sticky bottom-0 -mx-5 border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3"><SubmitButton className="min-h-12 w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]" pendingLabel={t("Salvando…")}>{t("Salvar lançamento")}</SubmitButton></div>
      </form>}
  </>;
}
