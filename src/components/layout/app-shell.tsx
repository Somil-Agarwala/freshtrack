"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { showsBottomNav } from "@/config/nav";
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
  const nav = showsBottomNav(pathname);

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
          {children}
          {nav && <BottomNav />}
        </div>
      </CountDraftProvider>
    </DashboardFiltersProvider>
  );
}
