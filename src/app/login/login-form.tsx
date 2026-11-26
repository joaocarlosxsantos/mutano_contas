"use client";

import { useLocale } from "@/lib/i18n/context";
import { translateError } from "@/lib/i18n/dictionaries";
import { useTranslation } from "@/lib/i18n/use-translation";


import { useActionState } from "react";
import { loginAction, type FormState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";

const initial: FormState = {};

export function LoginForm() {
  const t = useTranslation();
  const locale = useLocale();

  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form aria-busy={pending} action={formAction} className="space-y-4">
      <Field label={t("E-mail")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="email" type="email" autoComplete="email" required placeholder={t("voce@email.com")} />
      </Field>
      <Field label={t("Senha")}>
        <Input className="min-h-12 min-w-0 max-w-full text-base!" name="password" type="password" autoComplete="current-password" required placeholder={t("Sua senha")} />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-[var(--color-money-out-soft)] px-3.5 py-2.5 text-[0.8125rem] text-[var(--text-out)]">
          {translateError(state.error, locale)}
        </p>
      ) : null}

      <SubmitButton className="min-h-11 min-w-11 w-full" pendingLabel={t("Entrando...")}>
        {t("Entrar")}</SubmitButton>
    </form>
  );
}
