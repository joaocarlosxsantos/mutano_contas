export type Locale = "pt-BR" | "en";
export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "fin-locale";

export function parseLocale(value?: string | null): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export function getIntlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "pt-BR";
}
