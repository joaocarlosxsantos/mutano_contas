import type { UsageProfile } from "@/lib/usage-profile";
import { knowledgeCatalog, trustedHelp, type HelpChunk } from "./catalog";

export const normalizeHelp = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const stop = new Set("a o as os um uma uns umas de da do das dos e em no na nos nas para por com eu meu minha meus minhas como onde qual quais que quando porque porquanto se ao aos este esta isso isso uso usar posso fazer app mutano preciso quero veja ver dado pessoal removido".split(" "));
const aliases: Record<string, string> = { transacao: "lancamento", transacoes: "lancamentos", faturas: "fatura", cartoes: "cartao", orcamentos: "orcamento", configurar: "configuracao", backup: "exportar" };
const terms = (value: string) => normalizeHelp(value).split(" ").filter(term => term.length > 2 && !stop.has(term)).map(term => aliases[term] ?? term);

export function retrieveKnowledge(question: string, profile: UsageProfile): HelpChunk[] {
  const query = [...new Set(terms(question))];
  if (!query.length) return [];
  const ranked = knowledgeCatalog.chunks.filter(chunk => chunk.profiles.includes(profile)).map(chunk => {
    const title = terms(chunk.title), keywords = terms(chunk.aliases), body = terms(chunk.text);
    let score = query.reduce((sum, term) => sum + (title.includes(term) ? 7 : 0) + (keywords.includes(term) ? 5 : 0) + (body.includes(term) ? 1 : 0), 0);
    if (chunk.source === "faq.md" && normalizeHelp(chunk.title) === normalizeHelp(question)) score += 100;
    if (chunk.source === "catalogo.md" || chunk.source === "regras.md") score *= 0.2;
    return { chunk, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
  return trustedHelp({ profile, chunks: ranked.slice(0, 3).map(item => item.chunk) });
}
