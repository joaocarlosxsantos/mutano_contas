import { describe, expect, it } from "vitest";
import { financialHealth } from "../../finance";
import { translatePlanning } from "./planning";
import { translateServer } from "./server";

describe("english gaps", () => {
  it("translates health labels, forecast words, years and reauth waits", () => {
    for (const savingsRatePct of [0, 20]) {
      const health = financialHealth({ savingsRatePct, runwayMonths: savingsRatePct, emergencyMonthsTarget: 6, fixedShareOfIncomePct: 40 });
      for (const text of [health.label, ...health.parts.map((p) => p.label)]) expect(translateServer("en", text)).not.toBe(text);
    }
    expect(translateServer("en", "sobra")).toBe("surplus");
    expect(translatePlanning("en", "anos")).toBe("years");
    expect(translateServer("en", "Muitas tentativas de confirmação. Tente novamente em 3 minuto(s).")).toBe("Too many confirmation attempts. Try again in 3 minute(s).");
  });
});
