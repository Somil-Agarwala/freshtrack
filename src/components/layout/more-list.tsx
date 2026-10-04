"use client";

import Link from "next/link";
import { moreSections, type StepTone } from "@/config/nav";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "@/components/ft/icons";

const DOT: Record<StepTone, string> = {
  neutral: "bg-ink-faint",
  pickup: "bg-pickup",
  count: "bg-count",
  pile: "bg-pile",
  factory: "bg-factory",
  money: "bg-money",
  godown: "bg-godown",
};

/** Every page beyond the daily steps, grouped. Used by the menu and /more. */
export function MoreList({ onPick }: { onPick?: () => void }) {
  const { t, sub } = useLang();
  return (
    <>
      {moreSections.map((section) => (
        <section key={section.en} className="mt-2">
          <p className="mb-1.5 mt-3 text-sm font-bold text-ink-faint">
            {t(section.hi, section.en)} · {sub(section.hi, section.en)}
          </p>
          <div className="flex flex-col gap-1.5">
            {section.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onPick}
                className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-elevated px-3.5 transition-colors hover:bg-raised"
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[link.tone ?? "neutral"])} />
                <span className="flex-1">
                  <span className="block text-base font-bold leading-tight">{t(link.hi, link.en)}</span>
                  <span className="block text-[13px] text-ink-dim">{sub(link.hi, link.en)}</span>
                </span>
                <ChevronRightIcon size={18} className="text-ink-faint" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
