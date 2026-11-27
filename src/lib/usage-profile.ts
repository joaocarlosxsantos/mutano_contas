import type { Locale } from "@/lib/i18n/config";
import { translateServer } from "@/lib/i18n/dictionaries/server";
/** Política compartilhada pela navegação e pelas entradas do servidor. */
export const USAGE_PROFILES = ["integracao_total", "hibrido", "manual"] as const;
export type UsageProfile = (typeof USAGE_PROFILES)[number];
export type ProfileCapability = "manual-entry" | "integration";

function localizedPROFILE_OPTIONS(locale: Locale): { value: UsageProfile; label: string; description: string }[] { return [
  { value: "integracao_total", label: translateServer(locale, "Integração total"), description: translateServer(locale, "Movimentações só pelo Open Finance. Planejamento continua disponível.") },
  { value: "hibrido", label: translateServer(locale, "Híbrido"), description: translateServer(locale, "Open Finance, lançamentos e importação manual.") },
  { value: "manual", label: translateServer(locale, "Somente manual"), description: translateServer(locale, "Lançamentos e importação de arquivos, sem Open Finance.") },
]; }
export const PROFILE_OPTIONS: { value: UsageProfile; label: string; description: string }[] = localizedPROFILE_OPTIONS("pt-BR");
export function getProfileOptions(locale: Locale = "pt-BR") { return localizedPROFILE_OPTIONS(locale); }

export function isUsageProfile(value: unknown): value is UsageProfile {
  return USAGE_PROFILES.some((profile) => profile === value);
}

export function canUseCapability(profile: UsageProfile, capability: ProfileCapability): boolean {
  return capability === "manual-entry" ? profile !== "integracao_total" : profile !== "manual";
}

export function profileRestriction(profile: UsageProfile, capability: ProfileCapability, locale: Locale = "pt-BR"): string | null {
  if (canUseCapability(profile, capability)) return null;
  return capability === "manual-entry"
    ? translateServer(locale, "Seu perfil usa apenas Open Finance. Para lançar manualmente, altere o perfil em Minha conta.")
    : translateServer(locale, "Open Finance está desativado no perfil Somente manual. Altere o perfil em Minha conta para integrar.");
}

export function canVisitRoute(profile: UsageProfile, pathname: string): boolean {
  const at = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  if (at("/importar") || at("/recorrentes")) return canUseCapability(profile, "manual-entry");
  if (at("/configuracoes/integracao")) return canUseCapability(profile, "integration");
  return true;
}
