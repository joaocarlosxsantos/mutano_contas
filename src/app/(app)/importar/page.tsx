import { requireProfileRoute } from "@/server/usage-profile";
import { getAccounts, getCategories } from "@/server/queries";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts as accountsTable, importBatches } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { type Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";
import { ImportWizard } from "./import-wizard";
import { ImportHistory } from "./import-history";

async function resolveLocale(): Promise<Locale> {
  try {
    const { getLocale } = await import("@/lib/i18n/server");
    return await getLocale();
  } catch {
    return "pt-BR";
  }
}

export async function generateMetadata() {
  const locale = await resolveLocale();
  const dict = getActivityDict(locale);
  return { title: dict["Importar extrato"] };
}

export default async function ImportPage() {
  const locale = await resolveLocale();
  const dict = getActivityDict(locale);
  const { userId } = await requireProfileRoute("/importar");

  const [accounts, categories, history] = await Promise.all([
    getAccounts(userId),
    getCategories(userId),
    db
      .select({
        id: importBatches.id,
        fileName: importBatches.fileName,
        rowCount: importBatches.rowCount,
        savedRows: importBatches.savedRows,
        createdAt: importBatches.createdAt,
        accountName: accountsTable.name,
      })
      .from(importBatches)
      .innerJoin(accountsTable, eq(accountsTable.id, importBatches.accountId))
      .where(eq(importBatches.userId, userId))
      .orderBy(desc(importBatches.createdAt))
      .limit(8),
  ]);

  return (
    <>
      <PageHeader
        title={dict["Importar extrato ou fatura"]}
        description={dict["Suba o arquivo que o seu banco exporta. Nós lemos, sugerimos categoria linha a linha e bloqueamos o que já foi importado antes."]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ImportWizard
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            kind: c.kind as "INCOME" | "EXPENSE",
            nature: c.nature as "FIXED" | "VARIABLE",
            color: c.color,
          }))}
        />

        <div className="space-y-4">
          <Card className="min-w-0">
            <CardHeader title={dict["Onde encontrar o arquivo"]} />
            <ul className="muted space-y-2.5 text-[0.8125rem] leading-relaxed">
              <li>
                <strong className="text-[var(--text)]">{dict["Nubank:"]}</strong> {dict["extrato → exportar → CSV ou OFX. A fatura do cartão também sai em CSV."]}
              </li>
              <li>
                <strong className="text-[var(--text)]">{dict["Inter:"]}</strong> {dict["extrato → período → exportar OFX."]}
              </li>
              <li>
                <strong className="text-[var(--text)]">{dict["Itaú / Bradesco / Santander:"]}</strong> {dict["extrato → salvar em OFX (Money) ou CSV."]}
              </li>
              <li>
                <strong className="text-[var(--text)]">{dict["Outros:"]}</strong> {dict["qualquer CSV com colunas de data, descrição e valor funciona."]}
              </li>
            </ul>
          </Card>

          <Hint tone="info" title={dict["Fatura de cartão"]}>
            {dict["Ao escolher uma conta de cartão, escolha também o mês da fatura — todas as linhas do arquivo (parceladas ou não) são gravadas nesse mês, é assim que cada parcela cai no mês certo. Reimportar o mesmo mês substitui o que já tinha sido importado nele. Os valores também costumam vir positivos mesmo sendo gastos: marque \"inverter sinal\" se a prévia mostrar tudo como entrada."]}
          </Hint>

          {history.length ? (
            <Card className="min-w-0">
              <CardHeader
                title={dict["Importações recentes"]}
                subtitle={dict["Importou algo errado? Apague o lote e importe de novo."]}
              />
              <ImportHistory
                locale={locale}
                batches={history.map((b) => ({
                  id: b.id,
                  fileName: b.fileName,
                  rowCount: b.rowCount,
                  savedRows: b.savedRows,
                  createdAt: b.createdAt.toISOString(),
                  accountName: b.accountName,
                }))}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
