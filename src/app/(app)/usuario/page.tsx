import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/language-toggle";
import { requireUserId } from "@/lib/auth";
import { getUser } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { UserProfileForm } from "./profile-form";
import { AiKeyCard } from "./ai-key-card";

function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Minha conta") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }
export default async function UserPage() {
  const locale = await getLocale().catch(() => "pt-BR" as const);
  const user = await getUser(await requireUserId());
  return <>
    <PageHeader title={translatePlanning(locale, "Minha conta")} description={translatePlanning(locale, "Seu usuário e seu modo de usar o Mutano Contas.")} />
    <div className="max-w-xl space-y-6">
      <div className="border-b border-[var(--line)] pb-5"><p className="font-medium">{user.name}</p><p className="mt-1 break-words text-sm text-[var(--text-muted)]">{user.email}</p></div>
      <UserProfileForm profile={user.usageProfile} />
      <section aria-label="Idioma / Language" className="space-y-3">
        <h2 className="font-medium">Idioma / Language</h2>
        <LanguageToggle />
      </section>
      <AiKeyCard />
    </div>
  </>;
}
