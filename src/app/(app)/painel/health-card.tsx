import type { HealthResult } from "@/lib/finance";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/config";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";
import { translateServer } from "@/lib/i18n/dictionaries/server";

const LINKED_PART_LABEL = "Reserva de emergência";

const toneColor: Record<HealthResult["tone"], string> = {
  danger: "var(--color-money-out)",
  warn: "var(--color-variable)",
  ok: "var(--color-brand-500)",
  great: "var(--color-money-in)",
};

const toneText: Record<HealthResult["tone"], string> = {
  danger: "var(--text-out)",
  warn: "var(--text-warn)",
  ok: "var(--text-brand)",
  great: "var(--text-in)",
};

export function HealthCard({
  health,
  className,
  locale = "pt-BR",
}: {
  health: HealthResult;
  className?: string;
  locale?: Locale;
}) {
  const dict = getActivityDict(locale);
  const color = toneColor[health.tone];
  const textColor = toneText[health.tone];

  return (
    <section aria-label={dict["Saúde financeira"]} className={cn("h-full", className)}>
      <div className="mb-4 flex items-baseline justify-between border-b border-[var(--line)] pb-2">
        <div>
          <h2 className="text-[0.75rem] font-semibold tracking-normal text-[var(--text-muted)]">
            {dict["Saúde financeira"]}
          </h2>
          <p className="text-xs font-medium" style={{ color: textColor }}>
            {translateServer(locale, health.label)}
          </p>
        </div>
        <span
          className="tnum font-mono text-2xl font-semibold tracking-tight"
          style={{ color: textColor }}
        >
          {health.score}
        </span>
      </div>

      <ul className="space-y-3.5" role="list">
        {health.parts.map((part) => {
          const isReserve = part.label === LINKED_PART_LABEL;
          const displayLabel = isReserve ? dict["Reserva de emergência"] : translateServer(locale, part.label);
          return (
            <li key={part.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                {isReserve ? (
                  <a
                    href="#reserva-emergencia"
                    className="font-medium text-[var(--text-brand)] hover:underline"
                  >
                    {displayLabel}
                  </a>
                ) : (
                  <span className="font-medium text-[var(--text)]">{displayLabel}</span>
                )}
                <span className="tnum font-mono text-[var(--text-muted)] text-xs">
                  {part.score}/{part.max}
                </span>
              </div>
              {isReserve ? (
                <p className="text-xs text-[var(--text-muted)] leading-snug">
                  {part.score} {dict["de "]}{part.max} {dict["pts. Detalhes em "]}{" "}
                  <a href="#reserva-emergencia" className="font-medium text-[var(--text-brand)] underline">
                    {dict["Reserva de emergência"]}
                  </a>.
                </p>
              ) : (
                <>
                  <Progress
                    label={displayLabel}
                    value={(part.score / part.max) * 100}
                    color={color}
                    height={4}
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-snug">{translateServer(locale, part.hint)}</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
