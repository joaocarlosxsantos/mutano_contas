import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "./config";

const currentLocale = vi.hoisted(() => ({ value: "pt-BR" as Locale }));
const setLocaleMock = vi.fn();

vi.mock("@/lib/i18n/context", () => ({
  useLocale: () => currentLocale.value,
  useSetLocale: () => setLocaleMock,
}));

import { LanguageToggle } from "@/components/language-toggle";

describe("LanguageToggle accessibility and i18n", () => {
  it("renders accessible buttons with proper role, lang, min touch size and aria attributes in pt-BR", () => {
    currentLocale.value = "pt-BR";
    const html = renderToStaticMarkup(createElement(LanguageToggle));

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Idioma"');
    expect(html).toContain('type="button"');
    expect(html).toContain('lang="pt-BR"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('aria-label="Português"');
    expect(html).toContain('aria-label="English"');
    expect(html).toContain('min-h-11');
    expect(html).toContain('min-w-11');
    expect(html).toContain('focus-visible:outline-2');
    expect(html).toMatch(/aria-pressed="true"[^>]*>PT<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>EN<\/button>/);
  });

  it("updates aria-pressed and group label when locale is English", () => {
    currentLocale.value = "en";
    const html = renderToStaticMarkup(createElement(LanguageToggle));

    expect(html).toContain('aria-label="Language"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>PT<\/button>/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>EN<\/button>/);
  });
});
