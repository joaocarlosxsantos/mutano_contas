import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
vi.mock("@/db", () => ({ db: { select: () => { throw new Error("Use the scoped connection"); } } }));
import { getAtypicalSpendingToday, getMonthSummaryThroughDay } from "./queries";

function mockConnection(rows: unknown[]) {
  let predicate: SQL;
  let projection: Record<string, SQL>;
  const query = {
    from: () => query, leftJoin: () => query, innerJoin: () => query,
    where: (value: SQL) => { predicate = value; return query; },
    groupBy: async () => rows,
  };
  const connection = { select: (value: Record<string, SQL>) => { projection = value; return query; } };
  return {
    connection: connection as unknown as NonNullable<Parameters<typeof getMonthSummaryThroughDay>[3]>["connection"],
    predicate: () => new PgDialect().sqlToQuery(predicate),
    projection: () => projection,
  };
}

describe("insight queries", () => {
  it("sums through the inclusive cutoff using the existing owner, status and cash filters", async () => {
    const mock = mockConnection([{ kind: "EXPENSE", nature: "VARIABLE", total: "12345" }]);
    const result = await getMonthSummaryThroughDay("owner", { year: 2026, month: 2 }, 31, { connection: mock.connection, cardMode: "cash" });
    expect(result.expenseCents).toBe(12345);
    const { sql, params } = mock.predicate();
    expect(params).toContain("owner");
    expect(params).toContain("2026-02-01T00:00:00.000Z");
    expect(params).toContain("2026-03-01T00:00:00.000Z");
    expect(params).toContain("POSTED");
    expect(sql).toContain('"transactions"."is_transfer" =');
    expect(sql).toContain("<> 'CREDIT_CARD'");
  });

  it("uses the last 30 civil days and returns only qualifying categories with a real transaction", async () => {
    const good = { id: "food", name: "Alimentação", todayCents: "3000", historyCents: "30000", historyCount: "5", historyDays: "3", transactionId: "tx-1" };
    const mock = mockConnection([good, { ...good, id: "small", todayCents: "1900" }, { ...good, id: "no-history", historyCount: "4" }, { ...good, id: "no-tx", transactionId: null }]);
    const result = await getAtypicalSpendingToday("owner", new Date("2026-11-01T04:00:00Z"), mock.connection);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "food", day: "2026-11-01", todayCents: 3000, transactionId: "tx-1" });
    const { sql, params } = mock.predicate();
    expect(params).toContain("owner");
    expect(params).toContain("2026-10-02T00:00:00.000Z");
    expect(params).toContain("2026-11-02T00:00:00.000Z");
    expect(params).toContain("EXPENSE");
    expect(params).toContain("POSTED");
    expect(sql).toContain('"transactions"."is_card_payment" =');
    const projection = mock.projection();
    for (const key of ["todayCents", "historyCents", "historyCount", "historyDays", "transactionId"]) {
      const expression = new PgDialect().sqlToQuery(projection[key]);
      expect(expression.params.every(param => typeof param === "string")).toBe(true);
    }
    expect(new PgDialect().sqlToQuery(projection.transactionId).sql).toContain("array_agg");
  });
});
