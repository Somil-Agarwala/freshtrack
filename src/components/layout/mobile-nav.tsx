"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, PackageOpen, Plus, Send, type LucideIcon } from "lucide-react";
import { useLogCollection } from "@/components/collections/log-collection-provider";
import { cn } from "@/lib/utils";

const LEFT: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/collections", label: "Collections", icon: Inbox },
];
const RIGHT: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/sorted-bags", label: "Sorted bags", icon: PackageOpen },
  { href: "/dispatches", label: "Dispatches", icon: Send },
];

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-accent" : "text-ink-faint")}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

/**
 * Phone navigation: the claim pipeline in the thumb zone, with logging a
 * pickup -- the action done most often, usually standing at a party's
 * shop -- as the raised centre button. Everything else (records, master
 * data, settings) stays in the menu behind the top-left button.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { open } = useLogCollection();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        {LEFT.map((item) => <NavItem key={item.href} {...item} active={isActive(item.href)} />)}
        <div className="flex items-center justify-center">
          <button
            onClick={open}
            aria-label="Log a collection"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink ring-4 ring-base active:bg-accent-hi"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
        {RIGHT.map((item) => <NavItem key={item.href} {...item} active={isActive(item.href)} />)}
      </div>
    </nav>
  );
}
