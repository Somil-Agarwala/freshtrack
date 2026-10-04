"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ClipboardIcon, HomeIcon, LayersIcon, PlusIcon, SendIcon } from "@/components/ft/icons";

type Item = { href: string; hi: string; en: string; icon: ReactNode; active: string; match: (p: string) => boolean };

const ITEMS: Item[] = [
  { href: "/", hi: "घर", en: "Home", icon: <HomeIcon size={22} />, active: "bg-raised text-ink", match: (p) => p === "/" || p === "/dashboard" },
  { href: "/count", hi: "गिनती", en: "Count", icon: <ClipboardIcon size={22} />, active: "bg-count-tint text-count", match: (p) => p.startsWith("/count") },
  { href: "/piles", hi: "ढेर", en: "Piles", icon: <LayersIcon size={22} />, active: "bg-pile-tint text-pile", match: (p) => p.startsWith("/piles") },
  { href: "/send", hi: "भेजो", en: "Send", icon: <SendIcon size={22} />, active: "bg-factory-tint text-factory", match: (p) => p.startsWith("/send") },
];
const TEXT: Record<string, string> = { "/": "text-ink", "/count": "text-count", "/piles": "text-pile", "/send": "text-factory" };

/** Phone bottom menu: four steps and the big blue "new pickup" button. */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLang();

  const link = (item: Item) => {
    const on = item.match(pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={on ? "page" : undefined}
        className={cn("flex flex-col items-center gap-0.5 text-[13px]", on ? cn("font-bold", TEXT[item.href]) : "font-semibold text-ink-faint")}
      >
        <span className={cn("flex h-[30px] w-[52px] items-center justify-center rounded-full", on && item.active)}>{item.icon}</span>
        {t(item.hi, item.en)}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main menu"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t border-line bg-bar pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ height: "calc(78px + env(safe-area-inset-bottom))" }}
    >
      {ITEMS.slice(0, 2).map(link)}
      <Link href="/pickup" aria-label={t("नया माल", "New pickup")} className="flex flex-col items-center gap-0.5 text-[13px] font-semibold text-ink-faint">
        <span className="-mt-[26px] flex h-14 w-14 items-center justify-center rounded-full bg-pickup text-pickup-ink shadow-[0_0_0_6px_rgb(var(--c-bar))]">
          <PlusIcon size={28} />
        </span>
        {t("नया माल", "New")}
      </Link>
      {ITEMS.slice(2).map(link)}
    </nav>
  );
}
