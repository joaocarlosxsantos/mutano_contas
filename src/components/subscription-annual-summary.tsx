import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { annualSubscriptionCents } from "@/lib/insight-metrics";
import { formatCents } from "@/lib/money";
import type { DetectedSubscription } from "@/lib/subscriptions";

export function SubscriptionAnnualSummary({ subscriptions }: { subscriptions: DetectedSubscription[] }) {
  if (!subscriptions.length) return null;
  const total = subscriptions.reduce((sum, sub) => sum + annualSubscriptionCents(sub.currentAmountCents, sub.cadence), 0);
  const increases = subscriptions.filter(sub => sub.hasPriceIncrease && (sub.priceIncreaseCents ?? 0) > 0);
  return (
    <Card className="mb-4 min-w-0">
      <CardHeader title="Custo anual de assinaturas" subtitle="Estimativa com base nas cobranças detectadas, mensais e anuais." />
      <p className="text-sm">Você gasta <strong className="tnum">{formatCents(total)}/ano</strong> em assinaturas.</p>
      {increases.length > 0 && (
        <ul className="mt-3 space-y-2 text-xs">
          {increases.map(sub => <li key={sub.normalizedName} className="flex flex-wrap items-center gap-2">
            <span className="break-words font-medium">{sub.name}</span>
            <span className="rounded-md bg-[var(--out-soft)] px-2 py-1 text-[var(--text-out)]">
              Aumento: +{formatCents(annualSubscriptionCents(sub.priceIncreaseCents!, sub.cadence))}/ano
            </span>
          </li>)}
        </ul>
      )}
      <Link href="/recorrentes" className="mt-2 inline-flex min-h-11 items-center text-xs underline underline-offset-4">Revisar assinaturas</Link>
    </Card>
  );
}
