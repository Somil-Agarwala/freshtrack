"use client";

import Link from "next/link";
import { useEffect } from "react";
import { moreSections } from "@/config/nav";
import { useLang } from "@/lib/i18n";
import { ChevronRightIcon, XIcon } from "@/components/ft/icons";
import { LangToggle } from "./lang-toggle";

/**
 * Records, setup and admin pages. A bottom sheet on the phone, a panel
 * under the header on a desktop.
 */
export function MoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, sub } = useLang();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-start lg:justify-end lg:p-4 lg:pt-[76px]" role="dialog" aria-modal="true" aria-label={t("और", "More")}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[85dvh] w-full flex-col rounded-t-[22px] border border-line bg-surface lg:w-[380px] lg:rounded-[22px]">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <p className="font-display text-[22px] font-extrabold">{t("और", "More")}</p>
          <div className="flex items-center gap-2">
            <LangToggle className="lg:hidden" />
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-elevated">
              <XIcon size={20} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {moreSections.map((section) => (
            <section key={section.en} className="mt-2">
              <p className="mb-1 mt-3 text-sm font-bold text-ink-faint">
                {t(section.hi, section.en)} · {sub(section.hi, section.en)}
              </p>
              <div className="flex flex-col gap-1.5">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-elevated px-3.5 transition-colors hover:bg-raised"
                  >
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
        </div>
      </div>
    </div>
  );
}
