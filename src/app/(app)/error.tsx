"use client";

import { useTranslation } from "@/lib/i18n/use-translation";


import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslation();

  return <section role="alert" className="card min-w-0 space-y-4 p-6">
    <h1 className="text-display">{t("Não foi possível carregar os dados")}</h1>
    <p className="text-sm text-[var(--text-muted)]">{t("Tente novamente para recuperar esta tela.")}</p>
    <Button className="min-h-11" onClick={retry}>{t("Tentar novamente")}</Button>
  </section>;
}
