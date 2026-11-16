import { z } from "zod";

export const aiProviderSchema = z.enum(["claude", "openai", "gemini"]);
export type UserAiProvider = z.infer<typeof aiProviderSchema>;
export const aiCredentialSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().trim().min(20).max(256).regex(/^[A-Za-z0-9_-]+$/),
}).strict().superRefine(({ provider, apiKey }, ctx) => {
  const valid = provider === "claude" ? /^sk-ant-[A-Za-z0-9_-]{20,}$/ : provider === "openai"
    ? /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/ : /^AIza[A-Za-z0-9_-]{35}$/;
  if (!valid.test(apiKey)) ctx.addIssue({ code: "custom", path: ["apiKey"], message: "Formato de chave inválido para o provedor." });
});
