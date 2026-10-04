"use client";

import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { isFlowPath, showsBottomNav, titleFor } from "@/config/nav";
import { useLang } from "@/lib/i18n";
import { BackButton } from "@/components/ft/screen";
import { CountDraftProvider } from "@/components/count/count-draft";
import { MenuIcon } from "@/components/ft/icons";
import { BottomNav } from "./bottom-nav";
import { DashboardFiltersProvider } from "./dashboard-filters";
import { DesktopHeader } from "./desktop-header";
import { MoreMenu } from "./more-menu";

/**
 * Phone: every screen draws its own header; the bottom menu shows on the
 * main screens and hides during focused tasks (pickup steps, counting),
 * where the screen's own big button sits at the bottom instead.
 * Desktop: one top header with a link per step, content centred under it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nav = showsBottomNav(pathname);
  const flow = isFlowPath(pathname);

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
        {flow ? children : <RecordsFrame>{children}</RecordsFrame>}
        {nav && <BottomNav />}
      </div>
      </CountDraftProvider>
    </DashboardFiltersProvider>
  );
}

/** Records and admin pages: a plain phone header and normal page padding. */
function RecordsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t, sub } = useLang();
  const [moreOpen, setMoreOpen] = useState(false);
  const title = titleFor(pathname);

  return (
    <>
      <header className="flex items-center gap-3 px-4 pb-1 pt-4 lg:hidden">
        <BackButton href="/" label="Home" />
        <div className="min-w-0 flex-1">
          {title && (
            <>
              <p className="truncate font-display text-xl font-extrabold leading-tight">{t(title.hi, title.en)}</p>
              <p className="truncate text-sm text-ink-dim">{sub(title.hi, title.en)}</p>
            </>
          )}
        </div>
        <button type="button" onClick={() => setMoreOpen(true)} aria-label={t("और", "More")} className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-elevated">
          <MenuIcon />
        </button>
      </header>
      <main className="mx-auto max-w-[1360px] px-4 pb-6 pt-4 sm:px-6 lg:pt-6">{children}</main>
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
