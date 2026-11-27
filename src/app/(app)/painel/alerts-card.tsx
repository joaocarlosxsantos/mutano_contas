import Link from "next/link";
import { TriangleAlert, Info } from "lucide-react";
import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

export function AlertsCard({ alerts, className, locale = "pt-BR" }: { alerts: Alert[]; className?: string; locale?: Locale }) {
  if (!alerts.length) return null;
  const dict = getActivityDict(locale);

  return (
    <aside
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3.5",
        className,
      )}
      aria-label={dict["Avisos importantes"]}
    >
      <div className="mb-2 flex items-center justify-between border-b border-[var(--line)] pb-1.5">
        <h2 className="text-xs font-semibold tracking-normal text-[var(--text-muted)]">
          {dict["Avisos"]} ({alerts.length})
        </h2>
      </div>
      <ul className="divide-y divide-[var(--line)]" role="list">
        {alerts.map((a) => {
          const Icon = a.tone === "warn" ? TriangleAlert : Info;
          return (
            <li key={a.id} className="flex items-center gap-3 py-2 first:pt-1 last:pb-0.5">
              <span
                className={
                  a.tone === "warn"
                    ? "flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-warn-soft)] text-[var(--text-warn)]"
                    : "flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-save-soft)] text-[var(--text-brand)]"
                }
                aria-hidden="true"
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 text-xs">
                <span className="font-medium text-[var(--text)]">{a.title}</span>
                <span className="text-[var(--text-muted)]"> · {a.description}</span>
              </div>
              <Link
                href={a.href}
                className="inline-flex min-h-11 items-center shrink-0 text-xs font-medium text-[var(--text-brand)] hover:underline"
              >
                {a.linkLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
