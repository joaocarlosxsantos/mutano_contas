import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import { requireProfileRoute } from "@/server/usage-profile";
import { getOpenFinanceSetup } from "@/server/actions/open-finance";
import { PageHeader } from "@/components/page-header";
import { requireUserId } from "@/lib/auth";
import { IntegrationPanel } from "./panel";

function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Integração") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }

export default async function IntegrationPage() {
  const locale = await getLocale().catch(() => "pt-BR" as const);
  const userId = await requireUserId();
  await requireProfileRoute("/configuracoes/integracao");
  const setup = await getOpenFinanceSetup();
  return (
    <>
      <PageHeader
        title={translatePlanning(locale, "Integração")}
        description={translatePlanning(locale, "Conecte e sincronize suas contas bancárias automaticamente via Open Finance.")}
      />
      <IntegrationPanel initial={setup} userId={userId} />
    </>
  );
}
