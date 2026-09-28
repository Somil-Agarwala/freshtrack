"use client";

import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { ready } = useStore();

  return (
    <div className="min-h-screen bg-base">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="lg:pl-[72px]">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="p-4 sm:p-6">
          {/* Page data is built in the browser, so the server sends the shell
              only. This is also where a loading state goes once data comes
              from Supabase. */}
          {ready ? children : <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" aria-busy="true" />}
        </main>
      </div>
    </div>
  );
}
