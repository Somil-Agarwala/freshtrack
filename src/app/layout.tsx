import type { Metadata, Viewport } from "next";
import { Baloo_2, IBM_Plex_Mono, Mukta } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { LangProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { StoreProvider } from "@/lib/store";
import { siteConfig } from "@/config/site";
import "./globals.css";

// Mukta for reading, Baloo 2 for headings and big numbers, IBM Plex Mono
// for bag numbers -- each with Devanagari so Hindi renders in the same face.
const mukta = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-mukta" });
const baloo = Baloo_2({ subsets: ["latin", "devanagari"], weight: ["600", "700", "800"], variable: "--font-baloo" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-mono" });

// Rendered per request: every screen counts days from today, so a page
// prerendered at build time would show stale ages the next morning.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${siteConfig.name} | ${siteConfig.description}`,
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // "Add to Home Screen" opens it full-screen like an app, with its own icon.
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "black" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Long numbers (bag counts, rupee values) must not turn into phone links.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout read the safe-area insets of notched phones, so the
  // bottom bar clears the home indicator.
  viewportFit: "cover",
  themeColor: "#0E1116",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className={`${mukta.variable} ${baloo.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">
        <StoreProvider>
          <LangProvider>
            <SessionProvider>
              <AppShell>{children}</AppShell>
            </SessionProvider>
          </LangProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
