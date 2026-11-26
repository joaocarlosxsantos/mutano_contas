"use client";

import { useLocale } from "@/lib/i18n/context";
import { getComponentsTranslator } from "@/lib/i18n/dictionaries/components";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { ChevronDown, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { SITE_CHAT_COMMANDS, floatingChatBottom, buildRecentChatHistory, type ChatMessage } from "@/lib/site-chat";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import styles from "./site-chat.module.css";

export const SITE_CHAT_GREETING: ChatMessage = { id: 0, role: "assistant", text: "Oi! 👋 Vamos olhar suas contas? Escolha um comando ou escreva sua pergunta." };

type TranscriptMessage = ChatMessage & { href?: string; linkLabel?: string };

export function ChatTranscript({ messages, busy }: { messages: TranscriptMessage[]; busy: boolean }) {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  return <div role="log" aria-label={t("Conversa com o Mutano")} aria-live="polite" aria-relevant="additions" aria-busy={busy} className="space-y-4">
    {messages.map(message => <div key={message.id} className={message.role === "user" ? "ml-8 text-right" : "mr-3"}>
      <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{message.role === "user" ? t("Você") : "Mutano"}</span>
      <div className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-2.5 text-left text-sm leading-relaxed ${message.role === "user" ? "bg-[var(--acento)] text-[var(--on-acento)]" : "bg-[var(--surface-2)] text-[var(--text)]"}`}>
        <p className="whitespace-pre-wrap break-words">{message.id === 0 ? t(message.text) : message.text}</p>
        {message.href && message.linkLabel ? <a href={message.href} className="mt-2 inline-flex min-h-11 items-center font-medium underline underline-offset-4">{t(message.linkLabel)}</a> : null}
      </div>
    </div>)}
  </div>;
}

export function ChatCommandMenu({ busy, onSelect }: { busy: boolean; onSelect: (command: string) => void }) {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  return <div id="site-chat-commands" role="group" className="grid grid-cols-2 gap-2 p-3" aria-label={t("Comandos disponíveis")}>
    {SITE_CHAT_COMMANDS.map(item => <Button key={item.command} type="button" variant="soft" disabled={busy}
      title={t(item.description)} onClick={() => onSelect(item.command)} className="min-h-11 h-auto justify-start px-3 py-2 text-left text-sm">
      {t(item.label)}
    </Button>)}
  </div>;
}

export function ChatTypingBubble() {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  return <div className="mt-3 mr-3" role="status" aria-live="polite">
    <span className="sr-only">{t("Assistente digitando")}</span>
    <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]" aria-hidden="true">Mutano</span>
    <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-muted)]" aria-hidden="true">
      <span>{t("digitando")}</span>
      <span className={styles.typingDots}><span className={styles.typingDot} /><span className={styles.typingDot} /><span className={styles.typingDot} /></span>
    </div>
  </div>;
}

export function ChatPending({ busy }: { busy: boolean }) {
  return busy ? <ChatTypingBubble /> : null;
}

export function SiteChat() {
  const locale = useLocale();
  const t = getComponentsTranslator(locale);

  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [messages, setMessages] = useState<TranscriptMessage[]>([SITE_CHAT_GREETING]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [bottom, setBottom] = useState<number>();
  const anchor = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const nextId = useRef(1);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, busy, open]);

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    // Respect existing navigation and the optional installation prompt, including dynamic height.
    const selector = 'nav[aria-label="Navegação principal mobile"], nav[aria-label="Main mobile navigation"], [data-pwa-install-banner]';
    const resize = new ResizeObserver(update);
    function update() {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const obstacles = [...document.querySelectorAll(selector)].map(node => node.getBoundingClientRect());
      const visualViewport = window.visualViewport;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const keyboardInset = Math.max(0, window.innerHeight - (viewportHeight + (visualViewport?.offsetTop ?? 0)));
      const navBottom = floatingChatBottom(window.innerHeight, { left: rect.left, right: rect.left + 48 }, obstacles);
      setBottom(Math.max(navBottom, keyboardInset + 16));
      anchor.current?.style.setProperty("--site-chat-viewport-height", `${viewportHeight}px`);
    }
    function observe() {
      resize.disconnect();
      document.querySelectorAll(selector).forEach(node => resize.observe(node));
      update();
    }
    const mutations = new MutationObserver(observe);
    mutations.observe(document.body, { childList: true, subtree: true });
    observe();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => { resize.disconnect(); mutations.disconnect(); window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); };
  }, []);

  async function submit(payload: { command: string } | { message: string }, displayText: string) {
    if (inFlight.current || signedOut) return;
    inFlight.current = true;
    setMenuOpen(false); setBusy(true); setError("");
    setQuestion("");
    setMessages(old => [...old.slice(-19), { id: nextId.current++, role: "user", text: displayText }]);
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const requestPayload = "message" in payload
        ? { message: payload.message, history: buildRecentChatHistory(messages) }
        : payload;
      const response = await fetch("/api/chat", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestPayload), signal: controller.signal });
      const result: unknown = await response.json().catch(() => ({}));
      if (response.status === 401) { setMessages([]); setSignedOut(true); throw new Error(t("🔒 Sua sessão terminou. Entre de novo para consultar.")); }
      if (!response.ok) {
        throw new Error(response.status === 429 ? t("⏳ Vamos dar uma pausa? Aguarde um minuto e tente de novo.") : t("⚠️ Não consegui consultar agora. Tente de novo em instantes."));
      }
      const reply = (result as { reply?: unknown })?.reply;
      if (typeof reply !== "string" || reply.length > 12_000) throw new Error(t("⚠️ Não consegui consultar agora. Tente de novo em instantes."));
      if ("message" in payload && /a ia está indisponível no momento/i.test(reply)) {
        setMessages(old => [...old.slice(-19), { id: nextId.current++, role: "assistant", text: t("💬 Para conversar por aqui, configure sua chave de IA em Minha conta."), href: "/usuario", linkLabel: t("Abrir Minha conta") }]);
      } else {
        setMessages(old => [...old.slice(-19), { id: nextId.current++, role: "assistant", text: reply }]);
      }
    } catch (cause) {
      if (controller.signal.aborted) setError(t("⏳ A consulta demorou mais que o esperado. Tente de novo."));
      else if (cause instanceof TypeError) setError(t("📶 Não consegui conectar. Confira sua conexão e tente de novo."));
      else setError(cause instanceof Error ? cause.message : t("⚠️ Não consegui consultar agora. Tente de novo em instantes."));
    } finally {
      clearTimeout(timeout); setBusy(false); inFlight.current = false; request.current = null;
    }
  }

  async function select(command: string) {
    if (command === "/pausar") {
      const accepted = await confirm({ title: t("Pausar avisos do Telegram?"), description: t("🔔 Você pode continuar consultando. Quando quiser retomar os avisos, abra Configurações."), confirmLabel: t("Pausar avisos") });
      if (!accepted) return;
    }
    await submit({ command }, command);
  }

  function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = question.trim();
    if (!message || busy || signedOut) return;
    void submit({ message }, message);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    event.currentTarget.form?.requestSubmit();
  }

  return <div ref={anchor} className={styles.anchor} style={bottom === undefined ? undefined : { "--site-chat-bottom": `${bottom}px` } as CSSProperties}>
    <button ref={launcher} type="button" aria-label={open ? t("Fechar chat de consultas") : t("Abrir chat de consultas")} aria-expanded={open}
      aria-haspopup="dialog" aria-controls={open ? "site-chat-panel" : undefined} onClick={() => open ? close() : setOpen(true)}
      className={`${open ? "sr-only" : "flex"} size-12 cursor-pointer items-center justify-center rounded-full bg-[var(--acento)] text-[var(--on-acento)] shadow-md transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--acento)] motion-reduce:transition-none`}>
      <MessageCircle className="size-6" aria-hidden="true" strokeWidth={1.5} />
    </button>
    {open && <section id="site-chat-panel" role="dialog" aria-modal="false" aria-labelledby="site-chat-title"
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}
      className={`${styles.panel} flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[var(--surface)] text-[var(--text)]`}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] p-3 pl-4">
        <div><h2 ref={heading} id="site-chat-title" tabIndex={-1} className="text-base font-semibold outline-none">{t("Chat de consultas")}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t("Mutano Contas · menu do Telegram")}</p></div>
        <Button type="button" variant="ghost" size="icon" onClick={close} aria-label={t("Fechar chat")}><X className="size-5" aria-hidden="true" /></Button>
      </header>
      <div ref={scroller} tabIndex={0} aria-label={t("Histórico de consultas")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-[var(--acento)]">
        <ChatTranscript messages={messages} busy={busy} />
        <ChatPending busy={busy} />
        {error && <p role="alert" className="mt-3 text-sm text-[var(--text-out)]">{t(error)}</p>}
        {signedOut && <a href="/login" className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">{t("Entrar novamente")}</a>}
      </div>
      <div className="flex min-h-0 max-h-[55%] shrink-0 flex-col border-t border-[var(--line)]">
        <Button type="button" variant="ghost" aria-expanded={menuOpen} aria-controls="site-chat-commands" disabled={signedOut}
          onClick={() => setMenuOpen(value => !value)} className="min-h-11 w-full shrink-0 justify-between rounded-none px-4">
          {t("Escolher comando")}<ChevronDown className={`size-4 ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </Button>
        {menuOpen && <div className="min-h-0 overflow-y-auto overscroll-contain"><ChatCommandMenu busy={busy || signedOut} onSelect={command => void select(command)} /></div>}
      </div>
      <form onSubmit={sendQuestion} className="flex shrink-0 items-end gap-2 border-t border-[var(--line)] p-3" aria-label={t("Enviar pergunta ao assistente")}>
        <label htmlFor="site-chat-question" className="sr-only">{t("Sua pergunta")}</label>
        <textarea id="site-chat-question" name="message" rows={2} maxLength={512} value={question}
          onChange={event => setQuestion(event.target.value)} onKeyDown={handleQuestionKeyDown}
          placeholder={t("Escreva sua pergunta…")} enterKeyHint="send" disabled={busy || signedOut}
          className="input-base min-h-12 min-w-0 flex-1 resize-none py-3 text-base! leading-5" />
        <Button type="submit" size="icon" aria-label={busy ? t("Enviando pergunta") : t("Enviar pergunta")} disabled={busy || signedOut || !question.trim()}>
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        </Button>
      </form>
    </section>}
  </div>;
}
