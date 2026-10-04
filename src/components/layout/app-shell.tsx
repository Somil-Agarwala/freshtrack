"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { LogCollectionProvider } from "@/components/collections/log-collection-provider";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const PIN_KEY = "freshtrack.sidebarPinned";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Pinning the sidebar open used to lay it over the page, hiding the
  // left 184px of every screen. Now it pushes the content across instead,
  // and the choice is remembered on this device.
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    try {
      setPinned(window.localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* storage blocked: start collapsed */
    }
  }, []);

  function changePinned(next: boolean) {
    setPinned(next);
    try {
      window.localStorage.setItem(PIN_KEY, next ? "1" : "0");
    } catch {
      /* not remembered, still works for this visit */
    }
  }

  return (
    <div className="min-h-screen bg-base" style={{ "--rail": pinned ? "256px" : "72px" } as CSSProperties}>
      <LogCollectionProvider>
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
          pinned={pinned}
          onPinnedChange={changePinned}
        />
        <div className="transition-[padding] duration-200 lg:pl-[var(--rail)]">
          <Topbar onMenuClick={() => setMobileNavOpen(true)} />
          {/* Bottom padding clears the phone bottom bar; it is 0 on desktop. */}
          <main className="px-4 pb-[calc(var(--nav-h)+1.5rem)] pt-4 sm:px-6 sm:pt-6">{children}</main>
        </div>
        <MobileNav />
      </LogCollectionProvider>
    </div>
  );
}
