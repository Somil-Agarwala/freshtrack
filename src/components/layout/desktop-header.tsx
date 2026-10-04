"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteConfig } from "@/config/site";
import { stepLinks, type StepTone } from "@/config/nav";
import { useLang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MenuIcon, SackIcon } from "@/components/ft/icons";
import { useDashboardFilters } from "./dashboard-filters";
import { LangToggle } from "./lang-toggle";
import { MoreMenu } from "./more-menu";

const LINK_TEXT: Record<StepTone, string> = {
  neutral: "text-ink",
  pickup: "text-pickup-soft",
  count: "text-count-soft",
  pile: "text-pile-soft",
  factory: "text-factory-soft",
  money: "text-money-soft",
  godown: "text-godown-soft",
};

const selectClass = "h-10 rounded-[10px] border border-line bg-surface px-2.5 text-[15px] text-ink";

/** Desktop top header: logo, the six step links, dashboard pickers. */
export function DesktopHeader() {
  const pathname = usePathname();
  const { t } = useLang();
  const { userName } = useSettings();
  const { companies } = useStore();
  const { companyId, setCompanyId, period, setPeriod } = useDashboardFilters();
  const [moreOpen, setMoreOpen] = useState(false);
  const onDashboard = pathname === "/" || pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bar max-lg:hidden">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 font-display text-2xl font-extrabold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-money text-money-ink">
            <SackIcon size={22} strokeWidth={2.4} />
          </span>
          {siteConfig.name}
        </Link>
        <nav aria-label="Sections" className="flex flex-1 flex-wrap gap-1">
          {stepLinks.map((link) => {
            const on = link.href === "/" ? onDashboard : link.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={on ? "page" : undefined}
                className={cn("rounded-[10px] px-3.5 py-2 text-[15px]", LINK_TEXT[link.tone], on ? "bg-raised font-bold" : "font-semibold hover:bg-elevated")}
              >
                {t(link.hi, link.en)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[15px] font-semibold text-ink-dim hover:bg-elevated"
          >
            <MenuIcon size={18} />
            {t("और", "More")}
          </button>
        </nav>
        {onDashboard && (
          <>
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              {t("कंपनी", "Company")}
              <select className={selectClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="all">सभी · All</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              {t("समय", "Period")}
              <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value as "month" | "90d")}>
                <option value="month">इस महीने · This month</option>
                <option value="90d">पिछले 90 दिन · Last 90 days</option>
              </select>
            </label>
          </>
        )}
        <LangToggle />
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated font-display font-extrabold text-count" aria-label={userName}>
          {userName.slice(0, 1)}
        </span>
      </div>
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </header>
  );
}
