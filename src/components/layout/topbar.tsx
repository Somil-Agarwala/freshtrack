"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Menu, Settings as SettingsIcon, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { siteConfig } from "@/config/site";
import { GlobalSearch } from "./global-search";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on a tap anywhere else or Escape. (A full-screen click-catcher
  // does not work here: the header's backdrop blur confines fixed
  // children to the header, so taps on the page never reached it.)
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-base/85 px-3 backdrop-blur sm:gap-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-dim hover:bg-elevated lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* On a phone the sidebar is hidden, so the brand shows here instead. */}
      <Link href="/" className="flex min-w-0 items-center gap-2 sm:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-ink">
          {siteConfig.shortName}
        </span>
        <span className="truncate text-base font-semibold text-ink">{siteConfig.name}</span>
      </Link>

      <GlobalSearch />

      <div ref={menuRef} className="relative shrink-0 sm:ml-auto">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Account menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-1.5 hover:bg-elevated sm:pr-2"
        >
          <Avatar name="Somil" />
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-ink">Somil</p>
            <p className="text-xs text-ink-faint">Admin</p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-ink-faint sm:block" />
        </button>

        {menuOpen && (
          <>
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-line-strong bg-elevated py-1">
              <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink-dim hover:bg-raised hover:text-ink">
                <User className="h-4 w-4" /> Profile
              </Link>
              <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink-dim hover:bg-raised hover:text-ink">
                <SettingsIcon className="h-4 w-4" /> Settings
              </Link>
              <div className="my-1 h-px bg-line" />
              <button className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
