// Compartilhado pelas fronteiras de entrada/saída; nunca retorna o segredo detectado.
const secretSource = String.raw`\b(?:AIza[A-Za-z0-9._~+\/=-]{12,}|AQ\.[A-Za-z0-9._~+\/=-]{8,}|sk-ant-[A-Za-z0-9_-]{4,}|sk-[A-Za-z0-9_-]{8,}|Bearer[ \t]+[A-Za-z0-9._~+\/=-]{16,})`;
export const CHAT_SECRET_NOTICE = "🔒 Para proteger seus dados, não cole chaves aqui. Configure sua IA em Minha conta. Se já enviou uma chave, revogue-a no provedor e gere outra.";

export function containsChatSecret(text: string | undefined): boolean {
  return Boolean(text && new RegExp(secretSource, "i").test(text));
}

export function redactChatSecrets(text: string): string {
  return text.replace(new RegExp(secretSource, "gi"), "[segredo removido]");
}
