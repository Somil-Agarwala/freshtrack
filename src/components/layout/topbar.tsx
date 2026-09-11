"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Menu, Search, Settings as SettingsIcon, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-base/85 px-4 backdrop-blur sm:gap-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-dim hover:bg-elevated lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          placeholder="Search bags, SKUs, parties..."
          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </div>

      <div className="relative ml-auto shrink-0">
        <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-elevated">
          <Avatar name="Somil" />
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-ink">Somil</p>
            <p className="text-xs text-ink-faint">Admin</p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-ink-faint sm:block" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-line-strong bg-elevated py-1">
              <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-ink-dim hover:bg-raised hover:text-ink">
                <User className="h-4 w-4" /> Profile
              </Link>
              <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-ink-dim hover:bg-raised hover:text-ink">
                <SettingsIcon className="h-4 w-4" /> Settings
              </Link>
              <div className="my-1 h-px bg-line" />
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
