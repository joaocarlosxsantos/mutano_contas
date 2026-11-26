import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "../config";
import { en, ptBR, getComponentsDict, getComponentsTranslator } from "./components";

const language = vi.hoisted(() => ({ value: "pt-BR" as Locale }));
vi.mock("@/lib/i18n/context", () => ({ useLocale: () => language.value }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/painel",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/actions/recurring", () => ({ generateRecurring: vi.fn() }));
vi.mock("@/components/site-chat.module.css", () => ({ default: {} }));

import { CategoryBars } from "@/components/charts/category-bars";
import { MoneyTooltip } from "@/components/charts/tooltip";
import { chartMoney } from "@/components/charts/chart-utils";
import { MonthSwitcher } from "@/components/month-switcher";
import { AtypicalSpendingBanner } from "@/components/atypical-spending-banner";
import { RecurringBanner } from "@/components/recurring-banner";
import { SubscriptionAnnualSummary } from "@/components/subscription-annual-summary";
import { UsageProfileFields } from "@/components/usage-profile-fields";
import { OnboardingMediaSlot } from "@/components/onboarding/media-slot";
import { OnboardingSettingsActions } from "@/components/onboarding/settings-actions";
import { SectionTour } from "@/components/onboarding/section-tour";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ChatCommandMenu, ChatPending, ChatTranscript, SITE_CHAT_GREETING } from "@/components/site-chat";
import { NotificationSettings } from "@/components/notification-settings";
import { NotificationBell, notificationRequest } from "@/components/notification-center";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { SITE_CHAT_COMMANDS } from "@/lib/site-chat";
import { PROFILE_OPTIONS } from "@/lib/usage-profile";
import { getOnboardingTour } from "@/lib/onboarding";
import { formatCents } from "@/lib/money";

beforeEach(() => { language.value = "pt-BR"; });

describe("shared component dictionaries", () => {
  it("keeps every key and interpolation placeholder in both languages", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
    for (const key of Object.keys(ptBR) as (keyof typeof ptBR)[]) {
      expect(en[key].trim(), key).not.toBe("");
      expect(en[key].match(/\{\w+\}/g)?.sort() ?? [], key)
        .toEqual(ptBR[key].match(/\{\w+\}/g)?.sort() ?? []);
    }
    expect(getComponentsDict("pt-BR")).toBe(ptBR);
    expect(getComponentsDict("en")).toBe(en);
  });

  it("covers labels supplied by shared command, profile and tour catalogs", () => {
    for (const item of SITE_CHAT_COMMANDS) {
      expect(Object.hasOwn(en, item.label), item.label).toBe(true);
      expect(Object.hasOwn(en, item.description), item.description).toBe(true);
    }
    for (const item of PROFILE_OPTIONS) {
      expect(Object.hasOwn(en, item.label), item.label).toBe(true);
      expect(Object.hasOwn(en, item.description), item.description).toBe(true);
    }
    for (const profile of ["manual", "hibrido", "integracao_total"] as const) {
      for (const stop of getOnboardingTour(profile)) {
        expect(Object.hasOwn(en, stop.title), stop.title).toBe(true);
      }
    }
  });

  it("interpolates literal values and preserves unknown user text", () => {
    const t = getComponentsTranslator("en");
    expect(t("Dispensar aviso de {name} hoje", { name: "$& <Groceries>" }))
      .toBe("Dismiss today's alert for $& <Groceries>");
    expect(t("Café da Ana")).toBe("Café da Ana");
    expect(t("constructor")).toBe("constructor");
    expect(t("Período {number}")).toBe("Period {number}");
  });
});

describe("localized shared UI", () => {
  it("defaults to Portuguese and renders English month navigation", () => {
    expect(renderToStaticMarkup(createElement(LoadingSkeleton))).toContain("Carregando seus dados…");
    language.value = "en";
    const month = renderToStaticMarkup(createElement(MonthSwitcher, { value: { year: 2026, month: 2 } }));
    expect(month).toContain("Previous month");
    expect(month).toContain("Next month");
    expect(month).toContain("February 2026");
    expect(renderToStaticMarkup(createElement(LoadingSkeleton))).toContain("Loading your data…");
  });

  it("localizes chart empty states, grouped categories and tooltip money", () => {
    language.value = "en";
    expect(renderToStaticMarkup(createElement(CategoryBars, { slices: [], loading: true }))).toContain("Loading categories…");
    expect(renderToStaticMarkup(createElement(CategoryBars, { slices: [] }))).toContain("No expenses in this period");
    const html = renderToStaticMarkup(createElement(CategoryBars, { limit: 1, slices: [
      { id: "a", name: "Café", color: "", nature: "FIXED", totalCents: 123456 },
      { id: "b", name: "Cinema", color: "", nature: "VARIABLE", totalCents: 10000 },
    ] }));
    expect(html).toContain("Expenses by category:");
    expect(html).toContain("1 other category");
    expect(html).toContain("Café");
    expect(html).toContain(" · fixed");
    const tooltip = renderToStaticMarkup(createElement(MoneyTooltip, {
      active: true, payload: [{ name: "Entrou", value: 123456 }], label: "Feb/26",
    }));
    expect(tooltip).toContain("Income");
    expect(tooltip).toContain("1,234.56");
    expect(chartMoney(-123456, "en")).toBe(formatCents(-123456, "en").replace("-", "−"));
    expect(chartMoney(123456)).toBe(formatCents(123456, "pt-BR"));
  });

  it("localizes banner counts and labels while preserving category names", () => {
    language.value = "en";
    const atypical = renderToStaticMarkup(createElement(AtypicalSpendingBanner, { userId: "u", items: [{
      id: "a", name: "Café", day: "2026-02-03", todayCents: 123456, historyCents: 30000, transactionId: "t",
    }] }));
    expect(atypical).toContain("Unusual spending in Café");
    expect(atypical).toContain("Today:");
    expect(atypical).toContain("1,234.56");
    expect(atypical).toContain("View transaction");
    const recurring = (count: number) => renderToStaticMarkup(createElement(RecurringBanner, {
      count, monthRef: { year: 2026, month: 2 }, monthName: "fevereiro de 2026", incomeCents: 123456, expenseCents: 10000,
    }));
    expect(recurring(1)).toContain("1 recurring item not yet added for February 2026");
    expect(recurring(2)).toContain("2 recurring items not yet added for February 2026");
    expect(recurring(2)).toContain("expected income");
    expect(recurring(2)).toContain("Add all");
    const subscriptions = renderToStaticMarkup(createElement(SubscriptionAnnualSummary, { subscriptions: [{
      name: "Mensal", normalizedName: "monthly", currentAmountCents: 1000, cadence: "monthly",
      hasPriceIncrease: true, priceIncreaseCents: 100, isRegistered: true,
      lastChargedOn: "2026-02-03", monthOccurrences: 3,
    }] }));
    expect(subscriptions).toContain("Annual subscription cost");
    expect(subscriptions).toContain("120.00/year");
    expect(subscriptions).toContain("12.00/year");
    expect(subscriptions).toContain("Review subscriptions");
    expect(renderToStaticMarkup(createElement(SubscriptionAnnualSummary, { subscriptions: [] }))).toBe("");
  });

  it("localizes the iOS installation instructions and keeps a stable chat obstacle marker", () => {
    language.value = "en";
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("navigator", { userAgent: "iPhone" });
    vi.stubGlobal("localStorage", { getItem: () => null });
    try {
      const banner = renderToStaticMarkup(createElement(PwaInstallBanner));
      expect(banner).toContain('aria-label="Install app"');
      expect(banner).toContain("Install Mutano Contas");
      expect(banner).toContain('aria-label="Share"');
      expect(banner).toContain("Add to Home Screen");
      expect(banner).toContain("data-pwa-install-banner");
    } finally { vi.unstubAllGlobals(); }
  });

  it("localizes onboarding and usage modes", () => {
    language.value = "en";
    const fields = renderToStaticMarkup(createElement(UsageProfileFields, { defaultValue: "manual" }));
    expect(fields).toContain("How do you want to use the app?");
    expect(fields).toContain("Full integration");
    expect(fields).toContain("Manual only");
    const tour = renderToStaticMarkup(createElement(SectionTour, { userId: "u" }));
    expect(tour).toContain("Discover the app");
    expect(tour).toContain("Start tour");
    const media = renderToStaticMarkup(createElement(OnboardingMediaSlot, { src: "/demo.mp4", alt: "Example", caption: "Demo", type: "video" }));
    expect(media).toContain("Your browser cannot play this video.");
    expect(renderToStaticMarkup(createElement(OnboardingSettingsActions))).toContain("Resume first steps");
  });

  it("localizes chat controls and greeting while keeping conversations literal", () => {
    language.value = "en";
    const commands = renderToStaticMarkup(createElement(ChatCommandMenu, { busy: false, onSelect: () => {} }));
    expect(commands).toContain("Available commands");
    expect(commands).toContain("Pause notifications");
    expect(commands).toContain("View the weekly summary.");
    expect(renderToStaticMarkup(createElement(ChatPending, { busy: true }))).toContain("Assistant typing");
    const transcript = renderToStaticMarkup(createElement(ChatTranscript, { busy: false, messages: [
      SITE_CHAT_GREETING, { id: 1, role: "user", text: "Saldo <script>test</script>" },
    ] }));
    expect(transcript).toContain("Hi! 👋 Shall we look at your finances?");
    expect(transcript).toContain("You");
    expect(transcript).toContain("Saldo &lt;script&gt;test&lt;/script&gt;");
  });

  it("localizes notification controls and request failures", async () => {
    language.value = "en";
    const settings = renderToStaticMarkup(createElement(NotificationSettings));
    expect(settings).toContain("Notification preferences");
    expect(settings).toContain("Loading preferences…");
    expect(settings).toContain("Push on this device");
    expect(renderToStaticMarkup(createElement(NotificationBell))).toContain('aria-label="Notifications"');
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    try {
      await expect(notificationRequest("/api/notifications", undefined, "POST", "en"))
        .rejects.toThrow("Unable to load. Please try again.");
    } finally { vi.unstubAllGlobals(); }
  });
});
