import { describe, expect, it } from "vitest";
import { formatDate, formatDayMonth, monthLabel, monthShortLabel } from "../dates";
import { formatAxisCents, formatCents, formatCentsCompact, formatCentsParts, formatCentsPlain } from "../money";
import type { Locale } from "./config";

describe("localized dates", () => {
  const month = { year: 2026, month: 11 };
  it("keeps Portuguese defaults", () => {
    expect(monthLabel(month)).toBe("novembro de 2026");
    expect(monthShortLabel(month)).toBe("nov/26");
    expect(formatDate("2026-11-26")).toBe("26/11/2026");
    expect(formatDayMonth("2026-11-26")).toBe("26 nov");
  });
  it("formats English months and keeps civil dates in UTC", () => {
    expect(monthLabel(month, "en")).toBe("November 2026");
    expect(monthShortLabel(month, "en")).toBe("Nov/26");
    for (const date of ["2026-11-26", new Date("2026-11-26T00:00:00Z")]) {
      expect(formatDate(date, "en")).toBe("11/26/2026");
      expect(formatDayMonth(date, "en")).toBe("26 Nov");
    }
  });
});

describe("localized money", () => {
  it.each(["pt-BR", "en"] as Locale[])("uses BRL and avoids negative zero in %s", locale => {
    const intl = locale === "en" ? "en-US" : "pt-BR";
    const full = new Intl.NumberFormat(intl, { style: "currency", currency: "BRL" });
    const compact = new Intl.NumberFormat(intl, { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
    expect(formatCents(123456, locale)).toBe(full.format(1234.56));
    expect(formatCents(-0, locale)).toBe(full.format(0));
    expect(formatCentsParts(-0, locale).negative).toBe(false);
    expect(formatCentsParts(-123456, locale)).toMatchObject({ negative: true, integer: locale === "en" ? "1,234" : "1.234", decimal: locale === "en" ? "." : ",", fraction: "56" });
    expect(formatCentsCompact(999900, locale)).toBe(full.format(9999));
    expect(formatCentsCompact(1000000, locale)).toBe(compact.format(10000));
    expect(formatAxisCents(100000, locale)).toBe(compact.format(1000));
    expect(formatAxisCents(99900, locale)).toBe(full.format(999));
    expect(formatCentsPlain(123456, locale)).toBe(locale === "en" ? "1234.56" : "1234,56");
    expect(formatCentsPlain(-4590, locale)).toBe(locale === "en" ? "-45.90" : "-45,90");
  });
});
