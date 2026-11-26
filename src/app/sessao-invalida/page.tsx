import { LanguageToggle } from "@/components/language-toggle";
import { getLocale } from "@/lib/i18n/server";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";

export async function generateMetadata() { const t = getTranslator(await getLocale()); return { title: t("Sessão expirada") }; }

export default async function InvalidSessionPage() {
  const t = getTranslator(await getLocale());

  return (
    <>
    <header className="flex justify-end px-4 pt-3"><LanguageToggle /></header>
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8">
      <div className="card w-full max-w-sm p-5 sm:p-7">
        <h1 className="font-display text-display font-semibold tracking-tight">{t("Sessão expirada")}</h1>
        <p className="muted mt-2 mb-6 text-sm">{t("Sua sessão não está mais disponível. Confirme para entrar novamente.")}</p>
        <form action="/api/sessao-invalida" method="post">
          <Button type="submit" className="w-full">{t("Entrar novamente")}</Button>
        </form>
      </div>
    </main>
    </>
  );
}
