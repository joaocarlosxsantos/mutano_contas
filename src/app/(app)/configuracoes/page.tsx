import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/language-toggle";
import { canUseCapability } from "@/lib/usage-profile";
import { MobileDisclosure } from "@/components/ui/mobile-disclosure";
import { requireUserId } from "@/lib/auth";
import { getAccountsWithStats, getCategories, getUser } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { AccountsPanel } from "./accounts-panel";
import { CategoriesPanel } from "./categories-panel";
import { TelegramPanel } from "./telegram-panel";
import { BackupButton } from "./backup-button";
import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import { OnboardingSettingsActions } from "@/components/onboarding/settings-actions";

function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Configurações") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }

export default async function SettingsPage() {
  const locale = await getLocale().catch(() => "pt-BR" as const);
  const userId = await requireUserId();
  const [user, accounts, categories] = await Promise.all([
    getUser(userId),
    getAccountsWithStats(userId),
    getCategories(userId),
  ]);

  return (
    <>
      <PageHeader
        title={translatePlanning(locale, "Configurações")}
        description={translatePlanning(locale, "Renda, contas e categorias.")}
      />

      <OnboardingSettingsActions />

      <Card className="mb-4">
        <CardHeader title="Idioma / Language" subtitle={translatePlanning(locale, "Escolha o idioma do aplicativo.")} />
        <LanguageToggle />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 border-[var(--acento)]/30 lg:col-span-2">
          <CardHeader
            title={translatePlanning(locale, "Notificações")}
            subtitle={translatePlanning(locale, "Caixa de avisos no app, Web Push nativo (PWA) e preferências por canal.")}
          />
          <div className="p-4 pt-0">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--acento)] px-4 py-2 text-sm font-semibold text-[var(--on-acento)] transition hover:opacity-90"
              href="/notificacoes"
            >
              <Bell className="size-4" />
              {translatePlanning(locale, "Abrir notificações")} <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>

        <Card className="min-w-0 lg:col-span-2 xl:col-span-1">
          <CardHeader title="Telegram" subtitle={translatePlanning(locale, "Vincule seu chat privado ao Mutano Contas.")} />
          <TelegramPanel />
        </Card>
        {canUseCapability(user.usageProfile, "integration") && (<Card className="min-w-0 lg:col-span-2 xl:col-span-1">
          <CardHeader title="Open Finance" subtitle={translatePlanning(locale, "Conecte o Pluggy e escolha a fonte de cada conta.")} />
          <div className="p-4 pt-0"><Link className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--text-brand)] underline" href="/configuracoes/integracao">{translatePlanning(locale, "Configurar integração")}</Link></div>
        </Card>)}
        <Card className="min-w-0">
          <CardHeader
            title={translatePlanning(locale, "Perfil financeiro")}
            subtitle={translatePlanning(locale, "Renda e objetivos de economia.")}
          />
          <MobileDisclosure label={translatePlanning(locale, "Editar perfil financeiro")}><ProfileForm
            defaults={{
              name: user.name,
              income: user.monthlyIncomeCents,
              emergencyMonths: user.emergencyMonths,
              savingsTargetPct: user.savingsTargetPct,
            }}
          /></MobileDisclosure>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title={translatePlanning(locale, "Contas e cartões")}
            subtitle={translatePlanning(locale, "Gerencie suas contas financeiras.")}
          />
          <AccountsPanel
            accounts={accounts.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type,
              color: a.color,
              institution: a.institution,
              archived: a.archived,
              transactionCount: a.transactionCount,
              recurringCount: a.recurringCount,
              closingDay: a.closingDay,
              dueDay: a.dueDay,
            }))}
          />
        </Card>

        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title={translatePlanning(locale, "Categorias")}
            subtitle={translatePlanning(locale, "As palavras-chave são o que faz a importação adivinhar a categoria certa. Separe por vírgula.")}
          />
          <CategoriesPanel
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              kind: c.kind as "INCOME" | "EXPENSE",
              nature: c.nature as "FIXED" | "VARIABLE",
              color: c.color,
              keywords: c.keywords,
            }))}
          />
        </Card>

        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title={translatePlanning(locale, "Dados")}
            subtitle={translatePlanning(locale, "Exporte um backup completo do seu perfil financeiro em JSON.")}
          />
          <div className="p-4">
            <BackupButton />
          </div>
        </Card>
      </div>
    </>
  );
}
