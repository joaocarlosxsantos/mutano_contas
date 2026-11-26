import type { Locale } from "../config";
import { getCommonDict } from "./common";
import { getLandingAuthDict } from "./landing-auth";

export function getDictionary(locale: Locale) {
  return { ...getCommonDict(locale), ...getLandingAuthDict(locale) };
}
export type DictionaryKey = keyof ReturnType<typeof getDictionary>;
export function getTranslator(locale: Locale) {
  const dict = getDictionary(locale);
  return (key: DictionaryKey): string => dict[key];
}

/** Server actions may return validation text, never HTML. Keep dynamic values as text. */
export function translateError(message: string, locale: Locale): string {
  if (locale === "pt-BR") return message;
  const dict = getDictionary(locale);
  if (Object.hasOwn(dict, message)) return dict[message as DictionaryKey];
  if (Object.values(dict).includes(message)) return message;
  const retry = message.match(/^Muitas tentativas (para esta conta|a partir desta rede)\. Tente novamente em (\d+) minuto\(s\)\.$/);
  if (retry) return `Too many attempts ${retry[1] === "para esta conta" ? "for this account" : "from this network"}. Try again in ${retry[2]} minute(s).`;
  if (message.startsWith("Muitas tentativas")) return "Too many attempts. Try again in a few minutes.";
  const maxName = message.match(/^O nome não pode ultrapassar (\d+) caracteres\.$/);
  if (maxName) return `Name cannot exceed ${maxName[1]} characters.`;
  return "Please check the information and try again.";
}
