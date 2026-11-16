import { redactChatSecrets } from "@/lib/chat-secrets";

/** Não é detector universal de PII: DTOs evitam depender apenas de regex. */
export function redactQuestion(value: string): string {
  return redactChatSecrets(value)
    .replace(/https?:\/\/\S+|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[dado removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[dado removido]")
    .replace(/(?:\+?55[ .-]?)?\(?\d{2}\)?[ .-]?9?\d{4}[ .-]?\d{4}\b/g, "[dado removido]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[dado removido]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b|\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "[dado removido]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 512);
}

const categories = ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Serviços", "Salário", "Outros", "Sem categoria"];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export function categoryLabel(value: string | null, index: number) {
  return categories.find(category => normalize(category) === normalize(value ?? "Sem categoria")) ?? `Categoria ${index + 1}`;
}
export const dueBillLabel = (index: number) => `Conta a vencer ${index + 1}`;
