import { getLocale } from "@/lib/i18n/server";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/context";
import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import "./globals.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-next",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslator(locale);
  const description = t("Seu livro-caixa pessoal: gastos fixos e variáveis, reserva de emergência, metas e extratos.");
  return {
  title: { default: "Mutano Contas", template: "%s — Mutano Contas" },
  description,
  applicationName: "Mutano Contas",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://mutanocontas.vercel.app"),
  openGraph: { type: "website", locale: locale === "en" ? "en_US" : "pt_BR", siteName: "Mutano Contas", title: "Mutano Contas", description },
  twitter: { card: "summary_large_image", title: "Mutano Contas", description },
  // PWA — apple-touch-icon para iOS e referência explícita ao manifesto.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mutano Contas",
  },
  icons: {
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3EE" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

const themeScript = `
try {
  var stored = localStorage.getItem('fin-theme');
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale}>
        <ServiceWorkerRegistrar />
        {children}
        <PwaInstallBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
