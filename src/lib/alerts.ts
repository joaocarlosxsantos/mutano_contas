import type { Locale } from "@/lib/i18n/config";
import { translateServer } from "@/lib/i18n/dictionaries/server";
import { formatCents } from "./money";
import { formatDate } from "./dates";

export type AlertTone = "warn" | "info";

export type Alert = {
  id: string;
  tone: AlertTone;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
};

type BudgetAlertInput = {
  categoryId: string;
  name: string;
  limitCents: number | null;
  spentCents: number;
  remainingCents: number;
  status: string;
};

/**
 * Central de avisos do Painel: só dentro do app (sem e-mail nem push, por
 * enquanto — decisão explícita, não esquecimento). Cada função aqui é pura
 * e só olha para dados já carregados pela página, então dá para testar sem
 * banco e sem reimplementar a mesma regra em outro lugar.
 */
export function buildBudgetAlerts(rows: BudgetAlertInput[], locale: Locale = "pt-BR"): Alert[] {
  return rows
    .filter((r) => r.status === "estourou")
    .map((r) => ({
      id: `budget-${r.categoryId}`,
      tone: "warn",
      title: translateServer(locale, "Orçamento de \"{0}\" estourou", r.name),
      description: translateServer(locale, "Gasto de {0} passou o limite de {1} em {2}.", formatCents(r.spentCents, locale), formatCents(r.limitCents ?? 0, locale), formatCents(Math.abs(r.remainingCents), locale)),
      href: "/orcamento",
      linkLabel: translateServer(locale, "Ver orçamento"),
    }));
}

type GoalAlertInput = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  targetDate: Date | null;
  archived: boolean;
};

export function buildGoalAlerts(goals: GoalAlertInput[], now = new Date(), locale: Locale = "pt-BR"): Alert[] {
  return goals
    .filter((g) => !g.archived && g.targetDate && g.targetDate.getTime() < now.getTime() && g.savedCents < g.targetCents)
    .map((g) => ({
      id: `goal-${g.id}`,
      tone: "warn",
      title: translateServer(locale, "Meta \"{0}\" passou do prazo", g.name),
      description: translateServer(locale, "Prazo era {0} e ainda falta{1} {2}.", formatDate(g.targetDate as Date, locale), g.targetCents - g.savedCents === 1 ? "" : "m", formatCents(g.targetCents - g.savedCents, locale)),
      href: "/metas",
      linkLabel: translateServer(locale, "Ver metas"),
    }));
}
