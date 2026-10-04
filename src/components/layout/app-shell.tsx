"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { showsBottomNav } from "@/config/nav";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { SignInScreen } from "@/components/account/sign-in-screen";
import { BigLink, Screen, ScreenBody } from "@/components/ft/screen";
import { LockIcon } from "@/components/ft/icons";
import { CountDraftProvider } from "@/components/count/count-draft";
import { BottomNav } from "./bottom-nav";
import { DashboardFiltersProvider } from "./dashboard-filters";
import { DesktopHeader } from "./desktop-header";

/**
 * Phone: every screen draws its own header; the bottom menu shows on the
 * main screens and hides during focused tasks (pickup steps, counting),
 * where the screen's own big button sits at the bottom instead.
 * Desktop: one top header with a link per step, content centred under it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, ready, canVisit } = useSession();
  const nav = showsBottomNav(pathname);

  // Nothing until the saved sign-in is read, so the sign-in screen never
  // flashes up for someone who is already signed in.
  if (!ready) return <div className="min-h-[100dvh] bg-canvas" />;
  if (!user) return <SignInScreen />;

  const vars = {
    // Footers and sheets stack on top of whatever is fixed at the bottom.
    "--nav-h": nav ? "calc(78px + env(safe-area-inset-bottom))" : "0px",
    // The bottom menu already clears the home indicator; without it the
    // screen's own footer has to.
    "--safe-b": nav ? "0px" : "env(safe-area-inset-bottom)",
  } as CSSProperties;

  return (
    <DashboardFiltersProvider>
      <CountDraftProvider>
        <div className="min-h-[100dvh] bg-canvas pb-[var(--nav-h)] lg:pb-0 lg:[--nav-h:0px] lg:[--safe-b:0px]" style={vars}>
          <DesktopHeader />
          {canVisit(pathname) ? children : <NoAccess />}
          {nav && <BottomNav />}
        </div>
      </CountDraftProvider>
    </DashboardFiltersProvider>
  );
}

function NoAccess() {
  const { t } = useLang();
  return (
    <Screen>
      <ScreenBody className="items-center justify-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-ink-dim">
          <LockIcon size={30} />
        </span>
        <p className="font-display text-2xl font-extrabold">{t("यह पेज सिर्फ़ एडमिन के लिए है", "This page is for the admin")}</p>
        <p className="text-ink-dim">{t("ज़रूरत हो तो एडमिन से बात करें", "Ask the admin if you need it")}</p>
        <BigLink tone="neutral" href="/" className="mt-2 h-14 max-w-xs">
          {t("घर जाएँ", "Go home")}
        </BigLink>
      </ScreenBody>
    </Screen>
  );
}
