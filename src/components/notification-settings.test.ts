import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("rotulo de preferencia de sincronizacao", () => {
  it("explicita atualizacoes e problemas na categoria syncAlerts", () => {
    const source = readFileSync("src/components/notification-settings.tsx", "utf8");
    expect(source).toContain('["syncAlerts", "Atualiza\u00e7\u00f5es e problemas de sincroniza\u00e7\u00e3o"]');
  });
});
