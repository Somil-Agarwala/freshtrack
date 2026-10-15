"use client";

import { useState } from "react";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SortedBag } from "@/types";
import { MinusIcon, PlusIcon, SackIcon } from "@/components/ft/icons";
import { BigButton } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { BagNumber } from "@/components/count/bag-directions";

/**
 * Tying a bag. First: did everything go in? If yes, the bag is tied as it
 * is. If the bag filled up first, staff say how many pieces of each item
 * are left outside; the bag is tied with what fitted and those pieces get
 * a new numbered bag of the same MRP.
 *
 * `source` (a pickup, or "godown:<entry>") narrows the list to what that
 * pickup put in the bag -- the goods in hand right now.
 */
export function TieSheet({
  bag,
  source,
  nameOf,
  onClose,
  onTied,
}: {
  bag: SortedBag;
  source?: string;
  nameOf: (productId: string) => string;
  onClose: () => void;
  /** After tying; `moved` is the new bag the left-over pieces went into. */
  onTied: (moved: SortedBag | null) => void;
}) {
  const { t } = useLang();
  const { countLines, tieBag, tieBagWithLeftover } = useStore();
  const [step, setStep] = useState<"ask" | "left">("ask");
  const [left, setLeft] = useState<Record<string, number>>({});

  // What could be left outside: this pickup's pieces in the bag, or everything in it.
  const lines = countLines.filter((l) => l.bagId === bag.id && (!source || l.collectionId === source));
  const items = Array.from(lines.reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>()))
    .map(([productId, pieces]) => ({ productId, pieces }))
    .sort((a, b) => b.pieces - a.pieces);
  const outside = items.reduce((s, i) => s + Math.min(left[i.productId] ?? 0, i.pieces), 0);
  const stays = bag.pieceCount - outside;
  const set = (id: string, n: number, max: number) => setLeft((prev) => ({ ...prev, [id]: Math.max(0, Math.min(max, Math.round(n) || 0)) }));

  function tieAll() {
    if (tieBag(bag.id)) onTied(null);
    onClose();
  }

  function tieWithLeft() {
    const moved = tieBagWithLeftover(
      bag.id,
      items.map((i) => ({ productId: i.productId, pieces: Math.min(left[i.productId] ?? 0, i.pieces) })),
      source
    );
    if (moved) onTied(moved);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("बैग बाँधें", "Tie the bag")}
      description={`MRP ₹${bag.mrp} · ${num(bag.pieceCount)} ${t("पीस", "pcs")}`}
      footer={
        step === "left" ? (
          <BigButton tone="pile" onClick={tieWithLeft} disabled={outside === 0 || stays <= 0}>
            <SackIcon />
            {t(`बाँधें · ${num(outside)} पीस नए बैग में`, `Tie · ${num(outside)} pcs to a new bag`)}
          </BigButton>
        ) : undefined
      }
    >
      <div className="mb-3 rounded-2xl bg-elevated px-3.5 py-2.5">
        <BagNumber value={bag.bagNumber} className="block text-[24px]" />
      </div>

      {step === "ask" ? (
        <div className="flex flex-col gap-2.5">
          <p className="font-display text-[22px] font-extrabold leading-tight">{t("क्या सारा माल बैग के अंदर चला गया?", "Did all the goods go into the bag?")}</p>
          <button type="button" onClick={tieAll} className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-pile px-4 text-left font-display text-lg font-extrabold text-pile-ink hover:brightness-110">
            <SackIcon size={26} className="shrink-0" />
            <span>
              {t("हाँ, सब अंदर — बाँधें", "Yes, all inside — tie it")}
              <span className="block font-sans text-sm font-semibold opacity-80">{t(`बैग में ${num(bag.pieceCount)} पीस`, `${num(bag.pieceCount)} pcs in the bag`)}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep("left")}
            className="flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-count px-4 text-left font-display text-lg font-extrabold text-count hover:bg-count-tint"
          >
            <PlusIcon size={26} className="shrink-0" />
            <span>
              {t("नहीं, बैग भर गया — कुछ माल बाहर बचा", "No, the bag filled up — some is left outside")}
              <span className="block font-sans text-sm font-semibold text-ink-dim">{t("बचा माल नए नंबर वाले बैग में जाएगा", "What is left goes into a new numbered bag")}</span>
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-base leading-snug text-ink-soft">
            {t("जो पीस बैग में नहीं आ पाए, हर सामान के लिए उतने लिखें:", "For each item, how many pieces did not fit?")}
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {items.map((i) => {
              const n = left[i.productId] ?? 0;
              return (
                <li key={i.productId} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold">{nameOf(i.productId)}</span>
                    <span className="text-sm text-ink-dim">
                      {source ? t(`अभी डालने थे ${num(i.pieces)}`, `${num(i.pieces)} to put in`) : t(`बैग में ${num(i.pieces)}`, `${num(i.pieces)} in the bag`)}
                    </span>
                  </span>
                  <button type="button" aria-label={t("कम करें", "Less")} onClick={() => set(i.productId, n - 1, i.pieces)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-elevated">
                    <MinusIcon size={20} />
                  </button>
                  <input
                    aria-label={`${nameOf(i.productId)} ${t("बाहर बचे", "left outside")}`}
                    inputMode="numeric"
                    value={n ? String(n) : ""}
                    placeholder="0"
                    onChange={(e) => set(i.productId, Number(e.target.value.replace(/\D/g, "")), i.pieces)}
                    className={cn("h-11 w-20 shrink-0 rounded-xl border bg-canvas px-2 text-center font-display text-xl font-bold text-ink outline-none focus:border-count", n ? "border-count" : "border-line")}
                  />
                  <button type="button" aria-label={t("ज़्यादा करें", "More")} onClick={() => set(i.productId, n + 1, i.pieces)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-elevated">
                    <PlusIcon size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-pile-tint p-2.5">
              <p className="font-display text-2xl font-extrabold text-pile-soft">{num(Math.max(0, stays))}</p>
              <p className="text-sm text-ink-dim">{t("इस बैग में बँधेंगे", "tied in this bag")}</p>
            </div>
            <div className="rounded-2xl bg-count-tint p-2.5">
              <p className="font-display text-2xl font-extrabold text-count">{num(outside)}</p>
              <p className="text-sm text-ink-dim">{t("नए बैग में जाएँगे", "go to a new bag")}</p>
            </div>
          </div>
          {stays <= 0 && <p className="text-[15px] font-bold text-danger-soft">{t("बैग में कुछ तो रहना चाहिए", "Something has to stay in the bag")}</p>}
          <button type="button" onClick={() => setStep("ask")} className="self-start text-[15px] font-bold text-ink-dim">
            {t("← वापस", "← Back")}
          </button>
        </div>
      )}
    </Dialog>
  );
}
