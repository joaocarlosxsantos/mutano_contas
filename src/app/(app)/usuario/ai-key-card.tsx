"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";

type Provider = "claude" | "openai" | "gemini";
type SavedKey = { provider: Provider; last4: string };
type ViewState = { saved?: SavedKey; unavailable: boolean; message?: string; error?: string };

const providers: Record<Provider, { label: string; url: string; hint: string }> = {
  claude: { label: "Claude (Anthropic)", url: "https://console.anthropic.com/settings/keys", hint: "Crie uma chave em Settings → API Keys." },
  openai: { label: "ChatGPT (OpenAI)", url: "https://platform.openai.com/api-keys", hint: "Crie uma chave em API keys." },
  gemini: { label: "Gemini (Google)", url: "https://aistudio.google.com/apikey", hint: "Gere sua chave no Google AI Studio." },
};

function parseStatus(data: unknown): SavedKey | undefined {
  if (!data || typeof data !== "object") return;
  const value = data as Record<string, unknown>;
  const provider = value.provider;
  const last4 = value.last4;
  if (value.configured === true && (provider === "claude" || provider === "openai" || provider === "gemini") && typeof last4 === "string") {
    return { provider, last4: last4.slice(-4) };
  }
}

async function readResponse(response: Response) {
  if (response.status === 404 || response.status === 501) throw new Error("unavailable");
  if (response.status === 204) return undefined;
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 503 && data && typeof data === "object" && "code" in data && data.code === "service_unavailable") {
      throw new Error("unavailable");
    }
    const error = data && typeof data === "object" && "message" in data && typeof data.message === "string"
      ? data.message
      : data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Não foi possível concluir. Tente novamente.";
    throw new Error(error);
  }
  return data;
}

export function AiKeyCard() {
  const [provider, setProvider] = useState<Provider>("claude");
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [state, setState] = useState<ViewState>({ unavailable: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/usuario/ia-api-key", { cache: "no-store" })
      .then(readResponse)
      .then((data) => { if (active) setState({ saved: parseStatus(data), unavailable: false }); })
      .catch((error: unknown) => { if (active) setState(error instanceof Error && error.message === "unavailable" ? { unavailable: true } : { unavailable: false, error: "Não foi possível carregar o status da chave." }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!keyValue.trim() || state.unavailable) return;
    setSaving(true);
    setState((current) => ({ ...current, message: undefined, error: undefined }));
    try {
      const data = await readResponse(await fetch("/api/usuario/ia-api-key", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: keyValue.trim() }),
      }));
      const saved = parseStatus(data);
      setKeyValue("");
      setShowKey(false);
      setState({ saved: saved ?? { provider, last4: keyValue.trim().slice(-4) }, unavailable: false, message: "Chave salva com segurança." });
    } catch (error) {
      setState((current) => error instanceof Error && error.message === "unavailable" ? { ...current, unavailable: true } : { ...current, error: error instanceof Error ? error.message : "Não foi possível salvar a chave." });
    } finally { setSaving(false); }
  }

  async function remove() {
    setRemoving(true);
    setState((current) => ({ ...current, message: undefined, error: undefined }));
    try {
      await readResponse(await fetch("/api/usuario/ia-api-key", { method: "DELETE" }));
      setState({ unavailable: false, message: "Chave removida." });
      setConfirmRemove(false);
      setKeyValue("");
    } catch (error) {
      setState((current) => error instanceof Error && error.message === "unavailable" ? { ...current, unavailable: true } : { ...current, error: error instanceof Error ? error.message : "Não foi possível remover a chave." });
    } finally { setRemoving(false); }
  }

  const activeProvider = state.saved ? providers[state.saved.provider] : providers[provider];

  return (
    <Card className="min-w-0 lg:col-span-2 xl:col-span-1">
      <CardHeader title="Assistente de IA" subtitle="Use sua própria chave de API para conectar um provedor." />
      <div className="space-y-4 p-4 pt-0">
        {loading ? <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Carregando status…</p> : null}
        {!loading && !state.unavailable && state.saved ? (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <p className="flex min-w-0 items-center gap-2 text-sm"><KeyRound className="size-4 shrink-0 text-[var(--text-brand)]" aria-hidden="true" /><span className="min-w-0"><span className="font-medium">{providers[state.saved.provider].label}</span><span className="ml-2 font-mono text-[var(--text-muted)]">••••{state.saved.last4}</span></span></p>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmRemove(true)} disabled={removing}><Trash2 className="size-4" aria-hidden="true" />Remover</Button>
          </div>
        ) : null}
        {!loading && !state.saved && !state.unavailable ? (
          <form onSubmit={save} className="space-y-4">
            <Field label="Provedor">
              <Select className="min-h-12 text-base!" value={provider} onChange={(event) => setProvider(event.target.value as Provider)} disabled={saving || state.unavailable}>
                {Object.entries(providers).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </Select>
            </Field>
            <Field label="Chave de API" hint={<>{activeProvider.hint} <a className="font-medium text-[var(--text-brand)] underline" href={activeProvider.url} target="_blank" rel="noopener noreferrer">Abrir {activeProvider.label}<span className="sr-only"> (abre em nova aba)</span></a></>}>
              <div className="relative min-w-0">
                <Input className="min-h-12 pr-12 font-mono text-base!" type={showKey ? "text" : "password"} autoComplete="off" autoCapitalize="none" spellCheck={false} value={keyValue} onChange={(event) => setKeyValue(event.target.value)} placeholder="Cole sua chave aqui" disabled={saving || state.unavailable} />
                <button type="button" className="absolute inset-y-0 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--acento)]" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "Ocultar chave" : "Mostrar chave"} aria-pressed={showKey}>
                  {showKey ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </Field>
            <Button type="submit" disabled={saving || state.unavailable || !keyValue.trim()}><KeyRound className="size-4" aria-hidden="true" />{saving ? "Salvando…" : "Salvar chave"}</Button>
          </form>
        ) : null}
        {state.unavailable ? <p className="rounded-xl bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-muted)]">Recurso indisponível no momento.</p> : null}
        {!loading && !state.unavailable ? (
          <section className="space-y-3 border-t border-[var(--line)] pt-4" aria-labelledby="ai-key-guide-title">
            <h3 id="ai-key-guide-title" className="text-sm font-semibold text-[var(--text)]">Como obter sua chave</h3>
            <div className="space-y-2">
              <details className="group rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3" open>
                <summary className="cursor-pointer text-sm font-medium text-[var(--text)] marker:text-[var(--text-brand)]">Gemini <span className="ml-1 rounded-full bg-[var(--color-money-in-soft)] px-2 py-0.5 text-xs text-[var(--text-in)]">Recomendado · plano grátis</span></summary>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-[var(--text-muted)]">
                  <li><a className="text-[var(--text-brand)] underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Abra o Google AI Studio</a>.</li>
                  <li>Entre com sua conta Google.</li>
                  <li>Selecione <span className="font-medium text-[var(--text)]">Create API key</span>.</li>
                  <li>Copie a chave e cole no campo acima.</li>
                </ol>
              </details>
              <details className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">Claude · exige crédito pré-pago</summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">Na <a className="text-[var(--text-brand)] underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">página de API Keys da Anthropic</a>, escolha <span className="font-medium text-[var(--text)]">Create Key</span>, copie a chave e cole acima.</p>
              </details>
              <details className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">OpenAI · exige crédito</summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">Na <a className="text-[var(--text-brand)] underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">página de API keys da OpenAI</a>, escolha <span className="font-medium text-[var(--text)]">Create new secret key</span>, copie a chave e cole acima.</p>
              </details>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">Sua chave fica criptografada. Só os últimos 4 dígitos aparecem; ela não será exibida novamente e você pode removê-la quando quiser. No plano grátis do Gemini, o Google pode usar dados para treinamento.</p>
          </section>
        ) : null}
        {!state.unavailable ? <>
          {confirmRemove ? <div className="space-y-3 rounded-xl border border-[var(--line)] p-3" role="group" aria-label="Confirmar remoção da chave"><p className="text-sm">Remover a chave de {state.saved ? providers[state.saved.provider].label : "IA"}?</p><div className="flex flex-wrap gap-2"><Button type="button" variant="danger" onClick={remove} disabled={removing}>{removing ? "Removendo…" : "Sim, remover"}</Button><Button type="button" variant="outline" onClick={() => setConfirmRemove(false)} disabled={removing}>Cancelar</Button></div></div> : null}
          <div aria-live="polite" className="space-y-2 text-sm">
            {state.error ? <p role="alert" className="text-[var(--text-out)]">{state.error}</p> : null}
            {state.message ? <p className="text-[var(--text-in)]">{state.message}</p> : null}
          </div>
        </> : null}
      </div>
    </Card>
  );
}
