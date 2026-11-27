import { MessageCircle, UserCheck } from "lucide-react";
import { formatCents } from "@/lib/money";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { Money } from "@/components/ui/money";
import type { PersonReceivable } from "@/server/split-queries";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

export function ReceivablesSection({
  receivables,
  monthName,
  locale = "pt-BR",
}: {
  receivables: PersonReceivable[];
  monthName: string;
  locale?: Locale;
}) {
  const dict = getActivityDict(locale);
  const totalCents = receivables.reduce((acc, p) => acc + p.totalCents, 0);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between border-b border-[var(--line)] pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <UserCheck className="size-3.5 text-[var(--text-muted)]" />
            <h2 className="text-[0.75rem] font-semibold tracking-normal text-[var(--text-muted)]">
              {dict["A receber"]}
            </h2>
          </div>
          <p className="muted mt-0.5 text-xs">
            {monthName} · {dict["despesas divididas e contas"]}
          </p>
        </div>
        {totalCents > 0 ? (
          <Money cents={totalCents} tone="in" size="sm" className="font-semibold" />
        ) : null}
      </div>

      {receivables.length ? (
        <ul className="divide-y divide-[var(--line)]">
          {receivables.map((p) => {
            const message = locale === "en"
              ? `Hi, ${p.name}! Just a reminder about your share of expenses for ${monthName}: total of *${formatCents(p.totalCents, locale)}*.`
              : `Olá, ${p.name}! Passando para lembrar da sua parte nas despesas de ${monthName}: total de *${formatCents(p.totalCents, locale)}*.`;
            const waLink = buildWhatsAppLink(p.phone, message);

            return (
              <li
                key={p.name}
                className="flex items-center justify-between gap-3 py-2.5 text-[0.8125rem]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--text)]">{p.name}</p>
                  <p className="muted truncate text-xs">
                    {p.count} {p.count === 1 ? dict["despesa"] : dict["despesas"]}
                    {p.splitCents > 0 && p.billCents > 0
                      ? ` (${formatCents(p.splitCents, locale)} ${dict["lançamentos"]} + ${formatCents(p.billCents, locale)} ${dict["contas"]})`
                      : ""}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Money cents={p.totalCents} tone="in" size="sm" className="font-semibold" />

                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${dict["Cobrar "]}${p.name}${dict[" no WhatsApp"]}`}
                      title={`${dict["Enviar cobrança de "]}${formatCents(p.totalCents, locale)}${dict[" no WhatsApp para "]}${p.name}`}
                      className="cursor-pointer rounded-[var(--radius-xs)] p-1.5 text-[var(--text-in)] transition-colors hover:bg-[var(--color-money-in-soft)]"
                    >
                      <MessageCircle className="size-3.5" />
                    </a>
                  ) : (
                    <span
                      className="muted rounded-[var(--radius-xs)] p-1.5 opacity-30"
                      title={dict["Sem telefone cadastrado para WhatsApp"]}
                      aria-hidden
                    >
                      <MessageCircle className="size-3.5" />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted py-4 text-center text-xs">
          {dict["Nenhum valor a receber registrado neste mês."]}
        </p>
      )}
    </div>
  );
}
