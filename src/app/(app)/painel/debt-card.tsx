import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { formatCents, pct } from "@/lib/money";
import type { DebtOverview } from "@/server/queries";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

export function DebtCard({
  overview,
  incomeCents,
  className,
  locale = "pt-BR",
}: {
  overview: DebtOverview;
  incomeCents: number;
  className?: string;
  locale?: Locale;
}) {
  if (!overview.debts.length) return null;
  const dict = getActivityDict(locale);

  const share = incomeCents ? pct(overview.totalMonthlyInterestCents, incomeCents) : 0;

  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}
      aria-label={dict["Impacto das dívidas"]}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-money-out-soft)] text-[var(--text-out)]"
          aria-hidden="true"
        >
          <TrendingDown className="size-4" />
        </span>
        <div>
          <p className="text-xs font-medium tracking-normal text-[var(--text-muted)]">
            {dict["Saldo devedor"]}
          </p>
          <p className="tnum font-mono text-base font-semibold tracking-tight text-[var(--text)]">
            {formatCents(overview.totalBalanceCents, locale)}
          </p>
        </div>
      </div>

      <div className="border-l border-[var(--line)] pl-4">
        <p className="text-xs font-medium tracking-normal text-[var(--text-muted)]">
          {dict["Juros por mês"]}
        </p>
        <p className="tnum font-mono text-base font-semibold text-[var(--text-out)]">
          {formatCents(overview.totalMonthlyInterestCents, locale)}
          {share > 0 ? (
            <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
              ({share}% {dict["da renda"]})
            </span>
          ) : null}
        </p>
      </div>

      <div className="ml-auto">
        <Link
          href="/dividas"
          className="inline-flex min-h-11 items-center inline-flex h-7 items-center rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          {dict["Ver plano de quitação"]}
        </Link>
      </div>
    </div>
  );
}
