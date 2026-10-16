"use client";

import { useRouter } from "next/navigation";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { SortedBag } from "@/types";
import { BagNumber } from "@/components/ft/bag-number";
import { CheckIcon } from "@/components/ft/icons";
import { BigButton } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

/**
 * Right after a bag is tied: its number (to check it is on the bag) and,
 * if goods of that MRP are still waiting, the next bag's number to write on
 * a fresh bag.
 */
export function TiedDialog({
  result,
  onClose,
  onNext,
  after,
}: {
  result: { tied: SortedBag; next: SortedBag | null };
  onClose: () => void;
  /** "Fill the next bag" when there is one. */
  onNext: () => void;
  /** Where to go when that MRP is done. */
  after: { href: string; label: string };
}) {
  const { t } = useLang();
  const router = useRouter();
  const { tied, next } = result;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("बैग बँध गया", "Bag tied")}
      footer={
        next ? (
          <BigButton tone="pile" onClick={onNext}>
            {t("अगला बैग भरें", "Fill the next bag")}
          </BigButton>
        ) : (
          <BigButton tone="neutral" onClick={() => router.push(after.href)}>
            {after.label}
          </BigButton>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-pile p-3.5 text-pile-ink">
          <p className="flex items-center gap-2 text-base font-bold">
            <CheckIcon size={20} /> {t(`${num(tied.pieceCount)} पीस · फैक्ट्री के लिए तैयार`, `${num(tied.pieceCount)} pcs · ready for the factory`)}
          </p>
          <BagNumber value={tied.bagNumber} className="mt-1 block text-[26px]" />
          <p className="mt-1 text-sm font-semibold opacity-80">{t("यह नंबर बैग पर लिखा है ना?", "Is this number written on the bag?")}</p>
        </div>
        {next ? (
          <div className="rounded-2xl border-2 border-count bg-count-tint p-3.5">
            <p className="text-base font-bold text-count-note">{t("बाकी माल के लिए नया बैग — खाली बैग पर यह नंबर लिखें:", "New bag for what is left — write this number on an empty bag:")}</p>
            <BagNumber value={next.bagNumber} className="mt-1 block text-[26px] text-ink" />
          </div>
        ) : (
          <p className="rounded-2xl bg-money-tint p-3.5 text-base font-bold text-money-note">{t(`₹${tied.mrp} का सारा माल बैग में ✓`, `All ₹${tied.mrp} goods are in bags ✓`)}</p>
        )}
      </div>
    </Dialog>
  );
}
