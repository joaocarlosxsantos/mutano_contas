"use client";

import { useLocale } from "@/lib/i18n/context";
import { translateError } from "@/lib/i18n/dictionaries";
import { useTranslation } from "@/lib/i18n/use-translation";


import { useActionState } from "react";
import { registerAction, type FormState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";

const initial: FormState = {};

export function RegisterForm() {
  const t = useTranslation();
  const locale = useLocale();

  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <form aria-busy={pending} action={formAction} className="space-y-4">
      <Field label={t("Nome")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="name" required placeholder={t("Como quer ser chamado")} autoComplete="name" />
      </Field>
      <Field label={t("E-mail")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="email" type="email" required placeholder={t("voce@email.com")} autoComplete="email" />
      </Field>
      <Field label={t("Senha")} hint={t("Mínimo de 8 caracteres.")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder={t("Sua senha")} />
      </Field>
      <Field label={t("Confirmar senha")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="confirm" type="password" required minLength={8} autoComplete="new-password" placeholder={t("Sua senha")} />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-[var(--color-money-out-soft)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--text-out)]">
          {translateError(state.error, locale)}
        </p>
      ) : null}

      <SubmitButton className="min-h-11 min-w-11 w-full" pendingLabel={t("Criando...")}>
        {t("Criar conta")}</SubmitButton>
    </form>
  );
}
