import { LanguageToggle } from "@/components/language-toggle";
import { getLocale } from "@/lib/i18n/server";
import { getTranslator } from "@/lib/i18n/dictionaries";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export async function generateMetadata() { const t = getTranslator(await getLocale()); return { title: t("Criar conta") }; }

export default async function RegisterPage() {
  const t = getTranslator(await getLocale());

  const session = await auth();
  if (session?.user) redirect("/painel");

  return (
    <>
    <header className="flex justify-end px-4 pt-3"><LanguageToggle /></header>
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="min-w-0 w-full max-w-sm">
        <Link href="/" aria-label="Mutano Contas" className="mb-8 flex min-h-11 items-center justify-center">
          <Logo className="justify-center" />
        </Link>

        <div className="card p-5 sm:p-7">
          <h1 className="font-display text-display font-semibold tracking-tight">{t("Criar conta")}</h1>
          <p className="muted mt-1 mb-6 text-sm">
            {t("Categorias e contas iniciais prontas para uso.")}</p>
          <RegisterForm />
        </div>

        <p className="muted mt-6 text-center text-xs">
          {t("Já tem conta?")}{" "}
          <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-[var(--text-brand)] hover:underline">
            {t("Entrar")}</Link>
        </p>
      </div>
    </div>
    </>
  );
}
