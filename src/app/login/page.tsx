import { LanguageToggle } from "@/components/language-toggle";
import { getLocale } from "@/lib/i18n/server";
import { getTranslator } from "@/lib/i18n/dictionaries";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export async function generateMetadata() { const t = getTranslator(await getLocale()); return { title: t("Entrar") }; }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sessao?: string }>;
}) {
  const t = getTranslator(await getLocale());

  const { sessao } = await searchParams;
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
          <h1 className="font-display text-display font-semibold tracking-tight">{t("Entrar")}</h1>
          <p className="muted mt-1 mb-6 text-sm">{t("Acesse seu caderno de contas.")}</p>

          {sessao === "expirada" ? (
            <p className="mb-5 rounded-[4px] border border-[var(--border-warn)] bg-[var(--color-warn-soft)] px-3.5 py-2.5 text-xs text-[var(--text-warn)]">
              {t("Sua sessão expirou neste banco. Entre novamente.")}</p>
          ) : null}

          <LoginForm />
        </div>

        <p className="muted mt-6 text-center text-xs">
          {t("Não tem conta?")}{" "}
          <Link href="/cadastro" className="inline-flex min-h-11 items-center font-medium text-[var(--text-brand)] hover:underline">
            {t("Criar conta")}</Link>
        </p>
      </div>
    </div>
    </>
  );
}
