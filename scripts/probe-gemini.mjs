// Diagnóstico manual: node --env-file=.env scripts/probe-gemini.mjs
// Só usa GEMINI_API_KEY do ambiente. Nunca consulta credenciais de usuários.
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log(JSON.stringify({ code: "development_key_missing" }));
  process.exit(2);
}
const base = "https://generativelanguage.googleapis.com/v1beta/models";
const candidates = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
const safeCode = value => ["STOP", "MAX_TOKENS", "SAFETY", "INVALID_ARGUMENT", "UNAUTHENTICATED", "PERMISSION_DENIED", "RESOURCE_EXHAUSTED", "NOT_FOUND", "UNAVAILABLE", "INTERNAL"].includes(value) ? value : "unknown";
const headers = { "Content-Type": "application/json", "x-goog-api-key": key };

async function main() {
  const started = performance.now();
  const list = await fetch(`${base}?pageSize=100`, { headers, signal: AbortSignal.timeout(10_000), redirect: "error" });
  const metadata = await list.json();
  if (!list.ok) {
    console.log(JSON.stringify({ operation: "ListModels", status: list.status, code: safeCode(metadata?.error?.status), elapsedMs: Math.round(performance.now() - started) }));
    process.exitCode = 1; return;
  }
  const models = (metadata.models ?? []).filter(model => candidates.includes(model.name?.replace("models/", ""))
    && model.supportedGenerationMethods?.includes("generateContent"));
  console.log(JSON.stringify({ operation: "ListModels", status: list.status, elapsedMs: Math.round(performance.now() - started), models: models.map(model => ({
    name: model.name, supportedGenerationMethods: model.supportedGenerationMethods.filter(method => ["generateContent", "streamGenerateContent", "countTokens"].includes(method)),
  })) }));
  for (const entry of models) {
    const model = entry.name.replace("models/", "");
    const thinking = model.startsWith("gemini-2.5") ? [{ thinkingBudget: 0 }]
      : model === "gemini-3.8-flash" ? [{ thinkingLevel: "LOW" }] : [{ thinkingLevel: "MINIMAL" }, { thinkingLevel: "LOW" }];
    for (const mode of thinking) for (const tools of [false, true]) for (const streaming of [false, true]) {
      const started = performance.now();
      const payload = { contents: [{ role: "user", parts: [{ text: tools ? "Use get_balance para consultar o saldo de exemplo." : "Responda apenas OK." }] }],
        generationConfig: { maxOutputTokens: 1024, thinkingConfig: { ...mode, includeThoughts: false } },
        ...(tools ? { tools: [{ functionDeclarations: [{ name: "get_balance", description: "Saldo sintético para diagnóstico; nenhuma consulta real é executada.", parameters: { type: "object", properties: {} } }] }] } : {}),
      };
      try {
        const response = await fetch(`${base}/${model}:${streaming ? "streamGenerateContent?alt=sse" : "generateContent"}`, {
          method: "POST", headers, body: JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(12_000),
        });
        const headersMs = Math.round(performance.now() - started);
        const reader = response.body?.getReader(); let bytes = 0; let firstChunkMs = null;
        if (reader) try {
          while (true) { const item = await reader.read(); if (item.done) break;
            if (firstChunkMs === null) firstChunkMs = Math.round(performance.now() - started);
            bytes += item.value.byteLength; if (bytes > 32_768) break;
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        console.log(JSON.stringify({ model, thinking: mode.thinkingLevel ?? "OFF", tools, streaming, status: response.status,
          code: response.ok ? "completed" : "http_error", headersMs, firstChunkMs, elapsedMs: Math.round(performance.now() - started) }));
      } catch (error) {
        console.log(JSON.stringify({ model, thinking: mode.thinkingLevel ?? "OFF", tools, streaming, status: null,
          code: error?.name === "TimeoutError" ? "timeout" : "network_error", elapsedMs: Math.round(performance.now() - started) }));
      }
    }
  }
}
main().catch(() => { console.log(JSON.stringify({ code: "probe_failed" })); process.exitCode = 1; });
