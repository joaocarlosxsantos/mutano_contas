import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profiles = ["manual", "hibrido", "integracao_total"];
const routes = new Set(["painel", "insights", "lancamentos", "contas", "configuracoes", "contas-a-pagar", "orcamento", "metas", "recorrentes", "projecoes", "dividas", "importar", "configuracoes-integracao", "usuario", "notificacoes", "onboarding"]);
const hash = value => createHash("sha256").update(value).digest("hex");
const field = (text, name) => text.match(new RegExp(`^- \\*\\*${name}:\\*\\* ?(.*)$`, "m"))?.[1]?.replaceAll("`", "").trim();
const sections = text => text.split(/^## /m).slice(1).map(value => ({ title: value.slice(0, value.indexOf("\n")).trim(), body: value.slice(value.indexOf("\n") + 1).trim() }));

export function assertPublicHelp(text) {
  if (/\b(?:AIza[A-Za-z0-9_-]{20,}|AQ\.[A-Za-z0-9._~+\/=-]{12,}|sk-(?:ant-)?[A-Za-z0-9_-]{12,})|https?:\/\/|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/i.test(text)
    || /(?:ignore|desconsidere).{0,40}(?:instru|regra|prompt)|<\/?system>|process\.env|(?:user_id|userId)\s*[=:]/i.test(text))
    throw new Error("unsafe_public_help");
}

function splitText(text) {
  const chunks = []; let current = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.length > 1000) throw new Error("help_line_too_large");
    if ((current + "\n" + line).length > 1000) { if (current.trim()) chunks.push(current.trim()); current = ""; }
    current += (current ? "\n" : "") + line;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function buildKnowledge(root = path.join(project, "docs/ajuda")) {
  const realRoot = fs.realpathSync(root);
  if (fs.lstatSync(path.join(realRoot, "manifest.json")).isSymbolicLink()) throw new Error("invalid_help_path");
  const manifest = JSON.parse(fs.readFileSync(path.join(realRoot, "manifest.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.scope !== "public-product-help" || manifest.containsPersonalData !== false
    || !/^\d+\.\d+\.\d+$/.test(manifest.corpusVersion) || !Array.isArray(manifest.files) || !manifest.files.length
    || typeof manifest.owner !== "string" || !manifest.owner.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.reviewedAt)) throw new Error("invalid_help_manifest");
  const sources = new Map(); const allowedIds = new Set();
  for (const source of manifest.files) {
    if (!/^[a-z-]+\.md$/.test(source.path) || !Array.isArray(source.ids)) throw new Error("invalid_help_path");
    const filename = path.join(realRoot, source.path);
    if (fs.lstatSync(filename).isSymbolicLink() || !fs.realpathSync(filename).startsWith(realRoot + path.sep)) throw new Error("invalid_help_path");
    const text = fs.readFileSync(filename, "utf8").replaceAll("\r\n", "\n"); assertPublicHelp(text);
    for (const id of source.ids) {
      if (!/^[a-z0-9-]+$/.test(id) || allowedIds.has(id)) throw new Error("invalid_help_id");
      allowedIds.add(id);
    }
    sources.set(source.path, { text, ids: source.ids });
  }
  const entries = [];
  const guides = sources.get("guias.md");
  if (!guides) throw new Error("missing_help_guides");
  for (const [filename, allowed] of [["guias.md", manifest.allowedGuideIds], ["faq.md", manifest.allowedFaqIds]]) {
    const ids = sources.get(filename)?.ids ?? [];
    if (!Array.isArray(allowed) || ids.length !== allowed.length || ids.some(id => !allowed.includes(id))) throw new Error("help_manifest_mismatch");
  }
  for (const section of sections(guides.text)) {
    const id = field(section.body, "id"), routeKey = field(section.body, "route_key");
    const appliesTo = (field(section.body, "perfis") ?? "").split(/,\s*/);
    if (!guides.ids.includes(id) || !routes.has(routeKey) || appliesTo.some(profile => !profiles.includes(profile))
      || !section.title || section.title.length > 160 || !appliesTo.length
      || !/^\d{4}-\d{2}-\d{2}$/.test(field(section.body, "data_revisao") ?? "") || !field(section.body, "responsavel")
      || field(section.body, "versao") !== manifest.corpusVersion) throw new Error("invalid_help_metadata");
    const text = section.body.replace(/^- \*\*(?:id|aliases|route_key|perfis|versao|data_revisao|responsavel):\*\*.*\n?/gm, "").trim();
    entries.push({ baseId: id, title: section.title, aliases: field(section.body, "aliases") ?? "", routeKey, profiles: appliesTo, text, source: "guias.md" });
  }
  const faq = sources.get("faq.md");
  if (faq) for (const section of sections(faq.text)) {
    const id = section.title.replaceAll("`", ""), guide = entries.find(entry => entry.baseId === field(section.body, "guia"));
    if (!faq.ids.includes(id) || !guide || !field(section.body, "Pergunta") || !field(section.body, "Resposta")) throw new Error("invalid_help_faq");
    entries.push({ baseId: id, title: field(section.body, "Pergunta"), aliases: field(section.body, "aliases") ?? "", routeKey: guide.routeKey,
      profiles, text: `Pergunta: ${field(section.body, "Pergunta")}\nResposta: ${field(section.body, "Resposta")}`, source: "faq.md" });
  }
  for (const filename of ["catalogo.md", "regras.md"]) {
    const source = sources.get(filename); if (!source) continue;
    const id = field(source.text, "id");
    if (!source.ids.includes(id)) throw new Error("invalid_help_metadata");
    entries.push({ baseId: id, title: source.text.split("\n")[0].replace(/^# /, ""), aliases: field(source.text, "aliases") ?? "", routeKey: "configuracoes", profiles,
      text: source.text.replace(/^# .*\n/, "").replace(/^- \*\*(?:id|aliases):\*\*.*\n?/gm, "").trim(), source: filename });
  }
  const actualIds = new Set(entries.map(entry => entry.baseId));
  if (actualIds.size !== entries.length || actualIds.size !== allowedIds.size || [...allowedIds].some(id => !actualIds.has(id))) throw new Error("help_manifest_mismatch");
  const chunks = entries.flatMap(entry => splitText(entry.text).map((text, index) => {
    const value = { ...entry, text, id: `${entry.baseId}:${index + 1}`, version: manifest.corpusVersion };
    return { ...value, hash: hash(JSON.stringify(value)) };
  }));
  return { version: manifest.corpusVersion, hash: hash(JSON.stringify(chunks)), reviewedAt: manifest.reviewedAt, owner: manifest.owner, chunks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = buildKnowledge();
    const target = path.join(project, "src/server/ai/knowledge/corpus.generated.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ code: "help_corpus_built", chunks: result.chunks.length, version: result.version }));
  } catch { console.error("help_corpus_validation_failed"); process.exitCode = 1; }
}
