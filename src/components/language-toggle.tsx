"use client";

import { useLocale, useSetLocale } from "@/lib/i18n/context";
import { getCommonDict } from "@/lib/i18n/dictionaries/common";

export function LanguageToggle() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const dict = getCommonDict(locale);
  return <div role="group" aria-label={dict["Idioma"]} className="inline-flex shrink-0 rounded-xl border text-xs">
    {([['pt-BR', 'PT', 'Português'], ['en', 'EN', 'English']] as const).map(([value, label, name]) =>
      <button key={value} type="button" lang={value} aria-label={name} aria-pressed={locale === value} onClick={() => setLocale(value)}
        className="min-h-11 min-w-11 cursor-pointer rounded-xl px-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)] aria-pressed:bg-[var(--surface-2)] aria-pressed:font-semibold">{label}</button>)}
  </div>;
}
