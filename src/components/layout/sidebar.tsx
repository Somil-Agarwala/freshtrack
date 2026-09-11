"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { navSections } from "@/config/nav";
import { siteConfig } from "@/config/site";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

// Two distinct behaviours in one component:
// - lg and up: a 72px icon rail that expands to 256px on hover, with a
//   pin toggle for anyone who would rather not rely on hover.
// - below lg: fully off-canvas, slid in from the hamburger in the topbar.
//   Hover does not exist on touch, so entry is an explicit tap.
export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pathname = usePathname();
  const desktopExpanded = hovered || pinned;
  const showLabels = desktopExpanded || mobileOpen;

  // Exact match at the root, prefix match elsewhere, so /collections/c1
  // still highlights "Collections".
  function isActiveHref(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-[35] bg-black/60 lg:hidden" onClick={onMobileClose} aria-hidden="true" />}

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r border-line bg-surface transition-all duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          desktopExpanded ? "lg:w-64" : "lg:w-[72px]"
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-ink">
            {siteConfig.shortName}
          </div>
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-lg font-semibold text-ink transition-opacity duration-150",
              showLabels ? "opacity-100" : "opacity-0"
            )}
          >
            {siteConfig.name}
          </span>
          <button
            onClick={onMobileClose}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-elevated lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p
                className={cn(
                  "mb-2 px-2.5 text-xs font-medium text-ink-faint transition-opacity duration-150",
                  showLabels ? "opacity-100" : "opacity-0"
                )}
              >
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = isActiveHref(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onMobileClose}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors",
                          isActive ? "bg-accent/15 text-accent" : "text-ink-dim hover:bg-elevated hover:text-ink"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-accent" : "text-ink-faint group-hover:text-ink-dim")} />
                        <span
                          className={cn(
                            "overflow-hidden whitespace-nowrap transition-opacity duration-150",
                            showLabels ? "opacity-100" : "w-0 opacity-0"
                          )}
                        >
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <button
            onClick={() => setPinned((p) => !p)}
            className="mb-2 hidden w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium text-ink-faint hover:bg-elevated hover:text-ink-dim lg:flex"
          >
            {pinned ? <ChevronsLeft className="h-5 w-5 shrink-0" /> : <ChevronsRight className="h-5 w-5 shrink-0" />}
            <span className={cn("overflow-hidden whitespace-nowrap transition-opacity duration-150", showLabels ? "opacity-100" : "w-0 opacity-0")}>
              {pinned ? "Collapse sidebar" : "Keep expanded"}
            </span>
          </button>
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <Avatar name="Somil" />
            <div className={cn("min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150", showLabels ? "opacity-100" : "w-0 opacity-0")}>
              <p className="truncate text-sm font-medium text-ink">Somil</p>
              <p className="truncate text-xs text-ink-faint">Admin</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
