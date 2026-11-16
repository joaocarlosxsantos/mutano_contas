import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), delete: vi.fn(), fields: vi.fn(), where: vi.fn(), values: vi.fn(), upsert: vi.fn(), rows: [] as unknown[] }));
vi.mock("@/db", () => ({ db: { select: mocks.select, insert: mocks.insert, delete: mocks.delete } }));
import { claimAiCredentialRequest, getAiCredentialStatus, loadAiCredential, removeAiCredential, saveAiCredential } from "./credentials-store";
import { userAiCredentials } from "@/db/schema";
import { decryptSecret } from "@/server/open-finance/crypto";

beforeEach(() => {
  vi.clearAllMocks(); mocks.rows = [];
  vi.stubEnv("APP_ENCRYPTION_KEY", Buffer.alloc(32, 5).toString("base64"));
  const chain = { from: vi.fn().mockReturnThis(), where: mocks.where, limit: async () => mocks.rows,
    values: mocks.values, onConflictDoUpdate: mocks.upsert, returning: async () => mocks.rows };
  mocks.select.mockImplementation(fields => { mocks.fields(fields); return chain; });
  mocks.insert.mockReturnValue(chain); mocks.delete.mockReturnValue(chain);
  mocks.where.mockReturnValue(chain); mocks.values.mockReturnValue(chain); mocks.upsert.mockReturnValue(chain);
});
afterEach(() => vi.unstubAllEnvs());
const compile = (value: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(value);

describe("credenciais pessoais em repouso", () => {
  it("salva somente envelope/last4 e autentica dono e provedor na descriptografia", async () => {
    const apiKey = `sk-proj-${"a".repeat(40)}1234`;
    expect(await saveAiCredential("owner", "openai", apiKey)).toEqual({ configured: true, provider: "openai", last4: "1234" });
    const saved = mocks.values.mock.calls[0][0];
    expect(saved.apiKeyEnvelope).not.toContain(apiKey); expect(saved).not.toHaveProperty("apiKey");
    expect(decryptSecret(saved.apiKeyEnvelope, "owner", "ai-api-key:openai")).toBe(apiKey);
    expect(() => decryptSecret(saved.apiKeyEnvelope, "victim", "ai-api-key:openai")).toThrow();
    expect(() => decryptSecret(saved.apiKeyEnvelope, "owner", "ai-api-key:claude")).toThrow();
    mocks.rows = [{ provider: "openai", envelope: saved.apiKeyEnvelope }];
    expect(await loadAiCredential("owner")).toEqual({ provider: "openai", apiKey });
    await expect(loadAiCredential("victim")).rejects.toThrow();
  });
  it("GET não seleciona envelope e DELETE é restrito ao dono e idempotente", async () => {
    mocks.rows = [{ provider: "gemini", last4: "abcd" }];
    expect(await getAiCredentialStatus("owner")).toEqual({ configured: true, provider: "gemini", last4: "abcd" });
    expect(Object.keys(mocks.fields.mock.calls[0][0])).toEqual(["provider", "last4"]);
    expect(await removeAiCredential("owner")).toEqual({ configured: false, provider: null, last4: null });
    const filter = compile(mocks.where.mock.calls.at(-1)![0]);
    expect(filter).toEqual(compile(eq(userAiCredentials.userId, "owner")));
    mocks.rows = [];
    expect(await getAiCredentialStatus("owner")).toEqual({ configured: false, provider: null, last4: null });
    expect(await loadAiCredential("owner")).toBeNull();
  });
  it("contador distribuído satura e falha fechado sem resultado", async () => {
    mocks.rows = [{ count: 5 }]; expect((await claimAiCredentialRequest("owner", true)).allowed).toBe(true);
    expect(mocks.values.mock.calls[0][0].chatId).toBe("ai-key:write:owner");
    mocks.rows = [{ count: 6 }]; expect((await claimAiCredentialRequest("owner", true)).allowed).toBe(false);
    mocks.rows = [{ count: 60 }]; expect((await claimAiCredentialRequest("owner", false)).allowed).toBe(true);
    mocks.rows = []; await expect(claimAiCredentialRequest("owner", true)).rejects.toThrow();
  });
});
