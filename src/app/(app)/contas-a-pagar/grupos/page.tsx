import type { Locale } from "@/lib/i18n/config";
import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { getLocale } from "@/lib/i18n/server";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireUserId } from "@/lib/auth";
import { isSharedSchemaMissing, listSharedGroups, SHARED_GROUP_PATH } from "@/server/shared-groups";
import { CreateSharedGroup } from "./group-forms";

function localizedmetadata(locale: Locale) { return { title: translatePlanning(locale, "Grupos e acertos") }; }
export async function generateMetadata() { return localizedmetadata(await getLocale()); }

export default async function SharedGroupsPage() {
  const locale = await getLocale().catch(() => "pt-BR" as const);
  const userId = await requireUserId();
  const groups = await listSharedGroups(userId).catch((error: unknown) => {
    if (isSharedSchemaMissing(error)) return null;
    throw error;
  });
  return <>
    <Link href="/contas-a-pagar" className="mb-2 inline-flex min-h-11 items-center text-sm text-[var(--text-brand)] underline">{translatePlanning(locale, "Contas a pagar")}</Link>
    <PageHeader title={translatePlanning(locale, "Grupos e acertos")} description={translatePlanning(locale, "Divida despesas e acompanhe os acertos da casa.")} action={groups && <CreateSharedGroup />} />
    {groups === null ? <p role="status" className="muted text-sm">{translatePlanning(locale, "Os grupos estarão disponíveis após a atualização do banco.")}</p>
      : groups.length === 0 ? <p className="muted text-sm">{translatePlanning(locale, "Crie um grupo com as pessoas que dividem despesas com você.")}</p>
      : <ul className="grid gap-3 sm:grid-cols-2">{groups.map((group) => <li key={group.id}>
        <Link href={`${SHARED_GROUP_PATH}/${group.id}`} className="card flex min-h-14 min-w-0 items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-[var(--acento)]">
          <span className="min-w-0 break-words font-medium">{group.name}</span><span className="shrink-0 text-sm text-[var(--text-brand)]">{translatePlanning(locale, "Abrir")}</span>
        </Link>
      </li>)}</ul>}
  </>;
}
