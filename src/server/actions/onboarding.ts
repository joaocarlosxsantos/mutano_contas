"use server";

import { translateServer } from "@/lib/i18n/dictionaries/server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { isUsageProfile } from "@/lib/usage-profile";
import { getOnboardingJourney } from "@/server/onboarding";

export async function getMyOnboardingJourney() {
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const journey = await getOnboardingJourney();
  return { ...journey, steps: journey.steps.map(step => ({ ...step, title: translateServer(locale, step.title), actionLabel: translateServer(locale, step.actionLabel) })) };
}

/** Defer calibration only: explicitly choose a mode, preserve existing income/settings and satisfy the existing guard. */
export async function skipOnboardingCalibration(_previous: { error?: string; ok?: boolean }, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const userId = await requireUserId();
  const usageProfile = form.get("usageProfile");
  if (!isUsageProfile(usageProfile)) return { error: translateServer(locale, "Escolha como quer usar o app antes de continuar.") };
  const changed = await db.update(users).set({ usageProfile, onboardedAt: sql`coalesce(${users.onboardedAt}, now())`, updatedAt: new Date() })
    .where(eq(users.id, userId)).returning({ id: users.id });
  if (!changed.length) return { error: translateServer(locale, "Usuário não encontrado.") };
  revalidatePath("/", "layout");
  redirect("/painel");
}
