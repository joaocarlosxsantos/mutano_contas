import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import { requireUserId } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { NotificationsFeed } from "@/components/notification-center";
import { NotificationSettings } from "@/components/notification-settings";
function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Notificações") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }
export default async function NotificationsPage(){
  const locale = await getLocale().catch(() => "pt-BR" as const);await requireUserId();return <div className="space-y-6"><PageHeader title={translatePlanning(locale, "Notificações")} description={translatePlanning(locale, "Seus avisos e preferências, em um só lugar.")}/><section className="card p-4 sm:p-6"><NotificationsFeed/></section><NotificationSettings/></div>;}
