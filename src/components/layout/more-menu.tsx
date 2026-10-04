"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { XIcon } from "@/components/ft/icons";
import { LangToggle } from "./lang-toggle";
import { MoreList } from "./more-list";

/**
 * Records, setup and admin pages. A bottom sheet on the phone, a panel
 * under the header on a desktop.
 */
export function MoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();

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
          <MoreList onPick={onClose} />
        </div>
      </div>
    </div>
  );
}
