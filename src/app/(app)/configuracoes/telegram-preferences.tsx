"use client";

import { translatePlanning } from "@/lib/i18n/dictionaries/planning";
import { useLocale } from "@/lib/i18n/context";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { loadTelegramPreferences, saveTelegramPreferences } from "@/server/actions/telegram";
import type { Preferences } from "@/server/telegram/insights";
import { preferenceFeedback } from "./telegram-preferences-feedback";

export function TelegramPreferencesPanel() {
  const locale = useLocale();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    preferenceFeedback(loadTelegramPreferences, "initial-load", locale).then((result) => {
      if (!active) return;
      if (result.prefs) setPrefs(result.prefs);
      setUnavailable(Boolean(result.unavailable));
    });
    return () => { active = false; };
  }, [locale]);

  function reload() {
    setError("");
    startTransition(async () => {
      const result = await preferenceFeedback(loadTelegramPreferences, "reload", locale);
      if (result.prefs) setPrefs(result.prefs);
      setUnavailable(Boolean(result.unavailable));
      if (result.error) setError(result.error);
    });
  }

  if (!prefs) return <div className="space-y-3 text-sm">
    <p role="status" className="text-[var(--text-muted)]">{unavailable ? translatePlanning(locale, "Preferências do Telegram indisponíveis no momento.") : translatePlanning(locale, "Carregando preferências de avisos...")}</p>
    {unavailable && <Button variant="outline" disabled={pending} onClick={reload}>{pending ? translatePlanning(locale, "Carregando...") : translatePlanning(locale, "Tentar carregar preferências")}</Button>}
    {error && <p role="alert" className="text-[var(--text-out)]">{error}</p>}
  </div>;

  function save() {
    setError(""); setMessage("");
    startTransition(async () => {
      const result = await preferenceFeedback(() => saveTelegramPreferences(prefs), "save", locale);
      if (result.error) setError(result.error);
      if (result.message) setMessage(result.message);
    });
  }

  return (
    <form className="space-y-4 border-t border-[var(--border)] pt-4" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={prefs.enabled} disabled={pending} onChange={(e) => setPrefs({ ...prefs, enabled: e.target.checked })} />
        {translatePlanning(locale, "Receber avisos automáticos no Telegram vinculado")} </label>
      <fieldset disabled={pending} className="space-y-2">
        <legend className="text-sm font-medium">{translatePlanning(locale, "Horários de envio · São Paulo")}</legend>
        <p className="text-sm text-[var(--text-muted)]">{translatePlanning(locale, "Selecione as janelas que deseja receber. O envio pode ocorrer alguns minutos depois.")}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {([8, 14, 20] as const).map((hour) => <label key={hour} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={prefs.hours.includes(hour)} onChange={(e) => setPrefs({ ...prefs, hours: e.target.checked ? [...prefs.hours, hour] : prefs.hours.filter((h) => h !== hour) })} />
            {hour}{translatePlanning(locale, "h ·")} {hour === 8 ? translatePlanning(locale, "resumo da manhã") : hour === 14 ? translatePlanning(locale, "alertas da tarde") : "fechamento"}
          </label>)}
        </div>
      </fieldset>
      <fieldset disabled={pending} className="space-y-2">
        <legend className="text-sm font-medium">{translatePlanning(locale, "Tipos de aviso")}</legend>
        <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
          {([
            ["summary", translatePlanning(locale, "Resumo do dia")],
            ["spending", translatePlanning(locale, "Gasto acima da média")],
            ["dueBills", translatePlanning(locale, "Contas a pagar a vencer")],
            ["cardInvoice", translatePlanning(locale, "Faturas de cartão a vencer")],
            ["budget", translatePlanning(locale, "Orçamento de categorias (80% e 100%)")],
            ["negativeForecast", translatePlanning(locale, "Saldo previsto negativo")],
          ] as const).map(([key, title]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={prefs[key]} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })} />{title}
          </label>)}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending}>{pending ? translatePlanning(locale, "Salvando...") : translatePlanning(locale, "Salvar avisos")}</Button>
      <div aria-live="polite" className="text-sm">
        {error && <p role="alert" className="text-[var(--text-out)]">{error}</p>}
        {message && <p>{message}</p>}
      </div>
    </form>
  );
}
