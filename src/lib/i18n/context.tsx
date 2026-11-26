"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "./config";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
const SetLocaleContext = createContext<(next: Locale) => void>(() => {});

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [optimisticLocale, setOptimisticLocale] = useState(locale);
  const [previousLocale, setPreviousLocale] = useState(locale);
  const [, startTransition] = useTransition();
  // A refreshed server payload (including back/forward navigation) remains authoritative.
  if (locale !== previousLocale) {
    setPreviousLocale(locale);
    setOptimisticLocale(locale);
  }
  function setLocale(next: Locale) {
    const safe = parseLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${safe}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = safe;
    setOptimisticLocale(safe);
    startTransition(() => router.refresh());
  }
  return <LocaleContext.Provider value={optimisticLocale}><SetLocaleContext.Provider value={setLocale}>{children}</SetLocaleContext.Provider></LocaleContext.Provider>;
}

export function useLocale() { return useContext(LocaleContext); }
export function useSetLocale() { return useContext(SetLocaleContext); }
