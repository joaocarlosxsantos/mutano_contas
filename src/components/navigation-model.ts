import type { Locale } from "@/lib/i18n/config";
import { getTranslator, type DictionaryKey } from "@/lib/i18n/dictionaries";
import { BarChart3, FileUp, LayoutDashboard, PiggyBank, Plug, Receipt, ReceiptText, Repeat, Settings, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { canVisitRoute, type UsageProfile } from "@/lib/usage-profile";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };
export type NavigationSection = { id: string; label: string; items: NavigationItem[] };

const navigationSections: { id: string; label: DictionaryKey; items: (Omit<NavigationItem, "label"> & { label: DictionaryKey })[] }[] = [
  { id: "overview", label: "Visão geral", items: [
    { href: "/painel", label: "Painel", icon: LayoutDashboard },
    { href: "/insights", label: "Insights", icon: BarChart3 },
  ] },
  { id: "activity", label: "Movimentações", items: [
    { href: "/lancamentos", label: "Lançamentos", icon: Receipt },
    { href: "/contas", label: "Contas", icon: Wallet },
    { href: "/recorrentes", label: "Recorrentes", icon: Repeat },
    { href: "/importar", label: "Importar", icon: FileUp },
  ] },
  { id: "planning", label: "Planejamento", items: [
    { href: "/contas-a-pagar", label: "Contas a pagar", icon: ReceiptText },
    { href: "/orcamento", label: "Orçamento", icon: PiggyBank },
    { href: "/metas", label: "Metas", icon: Target },
    { href: "/dividas", label: "Dívidas", icon: TrendingDown },
    { href: "/projecoes", label: "Projeções", icon: TrendingUp },
  ] },
  { id: "integration", label: "Integração", items: [
    { href: "/configuracoes/integracao", label: "Conexões", icon: Plug },
  ] },
  { id: "account", label: "Conta", items: [
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ] },
];

const primaryRoutes = ["/painel", "/lancamentos", "/contas"];
export const primaryDestinations = primaryRoutes.map((href) => navigationSections.flatMap((section) => section.items).find((item) => item.href === href)!);

export function getNavigationSections(profile: UsageProfile, surface: "desktop" | "more", locale: Locale = "pt-BR"): NavigationSection[] {
  const t = getTranslator(locale);
  return navigationSections.map((section) => ({ ...section, label: t(section.label),
    items: section.items.filter((item) => canVisitRoute(profile, item.href) && (surface !== "more" || !primaryRoutes.includes(item.href))).map((item) => ({ ...item, label: t(item.label) })),
  })).filter((section) => section.items.length > 0);
}

/** The longest matching route wins, so Settings and Integration never both appear active. */
export function isDestinationActive(pathname: string, href: string) {
  const routes = [...navigationSections.flatMap((section) => section.items.map((item) => item.href)), "/usuario"];
  const active = routes.filter((route) => pathname === route || pathname.startsWith(`${route}/`)).sort((a, b) => b.length - a.length)[0];
  return active === href;
}

export function getPrimaryDestinations(locale: Locale = "pt-BR"): NavigationItem[] {
  const t = getTranslator(locale);
  return primaryDestinations.map(item => ({ ...item, label: t(item.label) }));
}
