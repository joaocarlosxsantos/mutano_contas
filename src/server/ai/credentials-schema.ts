import { z } from "zod";

export const aiProviderSchema = z.enum(["claude", "openai", "gemini"]);
export type UserAiProvider = z.infer<typeof aiProviderSchema>;
export const aiCredentialSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().trim().min(20).max(256).regex(/^[A-Za-z0-9._~+\/=-]+$/),
}).strict().superRefine(({ provider, apiKey }, ctx) => {
  // Gemini pode mudar prefixo/tamanho. A validação remota confirma a chave;
  // aqui bastam os limites e o charset seguros já verificados acima.
  const valid = provider === "claude" ? /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(apiKey) : provider === "openai"
    ? /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/.test(apiKey) : true;
  if (!valid) ctx.addIssue({ code: "custom", path: ["apiKey"], message: "Formato de chave inválido para o provedor." });
});
