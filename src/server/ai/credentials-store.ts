import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { telegramChatState, userAiCredentials } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/server/open-finance/crypto";
import { aiProviderSchema, type UserAiProvider } from "./credentials-schema";

const purpose = (provider: UserAiProvider) => `ai-api-key:${provider}`;
export const emptyAiStatus = { configured: false, provider: null, last4: null } as const;

export async function getAiCredentialStatus(userId: string) {
  const [row] = await db.select({ provider: userAiCredentials.provider, last4: userAiCredentials.last4 })
    .from(userAiCredentials).where(eq(userAiCredentials.userId, userId)).limit(1);
  return row ? { configured: true, provider: row.provider, last4: row.last4 } : emptyAiStatus;
}

/** Exclusivamente servidor: a chave descriptografada só vai para o provedor escolhido. */
export async function loadAiCredential(userId: string) {
  const [row] = await db.select({ provider: userAiCredentials.provider, envelope: userAiCredentials.apiKeyEnvelope })
    .from(userAiCredentials).where(eq(userAiCredentials.userId, userId)).limit(1);
  if (!row) return null;
  const provider = aiProviderSchema.parse(row.provider);
  return { provider, apiKey: decryptSecret(row.envelope, userId, purpose(provider)) };
}

export async function saveAiCredential(userId: string, provider: UserAiProvider, apiKey: string) {
  const apiKeyEnvelope = encryptSecret(apiKey, userId, purpose(provider));
  const last4 = apiKey.slice(-4);
  await db.insert(userAiCredentials).values({ userId, provider, apiKeyEnvelope, last4 })
    .onConflictDoUpdate({ target: userAiCredentials.userId, set: { provider, apiKeyEnvelope, last4, updatedAt: new Date() } });
  return { configured: true, provider, last4 };
}

export async function removeAiCredential(userId: string) {
  await db.delete(userAiCredentials).where(eq(userAiCredentials.userId, userId));
  return emptyAiStatus;
}

/** Contador atômico compartilhado entre instâncias; sem chave, corpo ou IP persistido. */
export async function claimAiCredentialRequest(userId: string, write: boolean) {
  const max = write ? 5 : 60;
  const expired = sql`${telegramChatState.windowStartedAt} <= clock_timestamp() - interval '1 minute'`;
  const [row] = await db.insert(telegramChatState).values({
    chatId: `ai-key:${write ? "write" : "read"}:${userId}`, lastUpdateId: 0, windowStartedAt: sql`clock_timestamp()`, requestCount: 1,
  }).onConflictDoUpdate({ target: telegramChatState.chatId, set: {
    windowStartedAt: sql`case when ${expired} then clock_timestamp() else ${telegramChatState.windowStartedAt} end`,
    requestCount: sql`case when ${expired} then 1 else least(${telegramChatState.requestCount} + 1, ${max + 1}) end`,
  } }).returning({ count: telegramChatState.requestCount });
  if (!row) throw new Error("ai_key_rate_limit_unavailable");
  return { allowed: row.count <= max, retryAfterSeconds: 60 };
}
