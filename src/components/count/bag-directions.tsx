"use client";

import { useState } from "react";
import { speak } from "@/lib/device";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Company, CountLine, SortedBag } from "@/types";
import { MrpCircle } from "@/components/ft/brand";
import { CheckIcon, PrinterIcon, SackIcon } from "@/components/ft/icons";
import { PrintLabel, PrintSheet } from "@/components/ft/print-sheet";
import { softButton } from "@/components/ft/screen";

/** HLD-M10-2026-0007 → ["HLD-M10-2026-", "0007"]: the serial is what people look at. */
export function splitBagNumber(bagNumber: string): [string, string] {
  const m = bagNumber.match(/^(.*-)(\d+)$/);
  return m ? [m[1], m[2]] : ["", bagNumber];
}

/** A bag number with its serial large, as it should be written on the bag. */
export function BagNumber({ value, className }: { value: string; className?: string }) {
  const [head, serial] = splitBagNumber(value);
  return (
    <span className={cn("font-mono font-semibold leading-none tracking-[0.5px]", className)}>
      <span className="text-[0.62em] opacity-75">{head}</span>
      <span>{serial}</span>
    </span>
  );
}

export interface BagCard {
  bag: SortedBag;
  items: { productId: string; pieces: number }[];
  /** Pieces this source put into the bag. */
  adding: number;
  /** Pieces in the bag from everything else. */
  before: number;
  /** This source's pieces opened the bag: write the number on a fresh bag. */
  isNew: boolean;
  /** Already tied (a re-count putting pieces back into a tied bag). */
  tied: boolean;
}

/**
 * The numbered bags one source's pieces went into -- a counted pickup, or a
 * godown entry -- with exactly which items and how many went into each.
 */
export function bagCards(sourceKey: string, lines: CountLine[], sortedBags: SortedBag[]): BagCard[] {
  return Array.from(new Set(lines.map((l) => l.bagId).filter((id): id is string => !!id)))
    .map((bagId) => sortedBags.find((b) => b.id === bagId))
    .filter((b): b is SortedBag => !!b)
    .map((bag) => {
      const here = lines.filter((l) => l.bagId === bag.id);
      // Lines that spill into the next bag are split, so merge per item.
      const items = Array.from(here.reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>()))
        .map(([productId, pieces]) => ({ productId, pieces }))
        .sort((a, b) => b.pieces - a.pieces);
      const adding = items.reduce((s, i) => s + i.pieces, 0);
      return { bag, items, adding, before: bag.pieceCount - adding, isNew: bag.openedFor === sourceKey, tied: bag.status !== "open" };
    })
    .sort((a, b) => a.bag.mrp - b.bag.mrp || a.bag.bagNumber.localeCompare(b.bag.bagNumber));
}

/** Reads the directions aloud, bag by bag. */
export function speakDirections(cards: BagCard[], nameOf: (id: string) => string, lang: "hi" | "en") {
  const parts = cards.map(({ bag, items, isNew }) => {
    const what = items.map((i) => `${nameOf(i.productId)} ${i.pieces}`).join(", ");
    return lang === "hi"
      ? `${isNew ? "नया बैग लें, उस पर नंबर लिखें" : "पहले से खुला बैग"} ${bag.bagNumber}। इसमें डालें: ${what}।`
      : `${isNew ? "Take a new bag and write" : "Open bag"} ${bag.bagNumber}. Put in: ${what}.`;
  });
  speak(parts.join(" "), lang);
}

/**
 * One card per numbered bag: the number to write or look for, the items and
 * pieces to put in, how many pieces the bag now holds, a button to tie it
 * when it is full, and a tick for when it is done.
 * Includes the sticker print for these bags.
 */
export function BagDirections({ cards, company, nameOf }: { cards: BagCard[]; company?: Company; nameOf: (id: string) => string }) {
  const { t, lang } = useLang();
  const { can } = useSession();
  const { tieBag } = useStore();
  const [done, setDone] = useState<string[]>([]);
  const newBags = cards.filter((c) => c.isNew).length;
  const allDone = cards.length > 0 && cards.every((c) => done.includes(c.bag.id));
  const toggle = (id: string) => setDone((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (cards.length === 0) return null;

  return (
    <>
      <p className="text-base leading-[1.35] text-ink-soft">
        {lang === "hi" ? (
          <>
            {newBags > 0 && (
              <>
                <b className="text-count-soft">{newBags} नया बैग</b> — खाली बैग लें और उस पर नंबर लिखें।{" "}
              </>
            )}
            हर बैग में सिर्फ़ नीचे लिखा माल डालें, फिर <b>✓</b> दबाएँ।
            <br />
            <span className="text-sm text-ink-faint">Write each new number on a fresh bag. Put in exactly what is listed, then tap ✓.</span>
          </>
        ) : (
          <>
            {newBags > 0 && (
              <>
                <b className="text-count-soft">
                  {newBags} new bag{newBags > 1 ? "s" : ""}
                </b>{" "}
                — take an empty bag and write its number on it.{" "}
              </>
            )}
            Put in exactly what is listed, then tap <b>✓</b>.
            <br />
            <span className="text-sm text-ink-faint">हर बैग में सिर्फ़ नीचे लिखा माल डालें।</span>
          </>
        )}
      </p>

      {cards.map(({ bag, items, adding, before, isNew, tied }) => {
        if (done.includes(bag.id)) {
          return (
            <button key={bag.id} type="button" onClick={() => toggle(bag.id)} className="flex items-center gap-3 rounded-[20px] border border-money-line bg-money-tint px-3.5 py-3 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-money text-money-ink">
                <CheckIcon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <BagNumber value={bag.bagNumber} className="block truncate text-[19px] text-money-note" />
                <span className="text-sm text-money-mute">
                  {num(adding)} {t("पीस डाल दिए", "pcs put in")}
                  {tied && ` · ${t("बँधा", "tied")}`}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold text-money-mute">{t("वापस खोलें", "Undo")}</span>
            </button>
          );
        }

        return (
          <section key={bag.id} className={cn("flex flex-col gap-3 rounded-[20px] p-3.5", tied ? "border-2 border-pile bg-pile-deep" : "border border-line bg-surface")}>
            <div className="flex items-start gap-3">
              <MrpCircle mrp={bag.mrp} size={52} />
              <span className="min-w-0 flex-1">
                <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[13px] font-extrabold", isNew ? "bg-count text-count-ink" : "bg-pile-tint text-pile-soft")}>
                  {isNew
                    ? t("नया बैग — यह नंबर लिखें", "New bag — write this number")
                    : tied
                      ? t(`बँधा बैग · ${num(before)} पीस`, `Tied bag · ${num(before)} pcs in it`)
                      : t(`पहले से खुला बैग · ${num(before)} पीस`, `Already open · ${num(before)} pcs in it`)}
                </span>
                <BagNumber value={bag.bagNumber} className="mt-1.5 block break-all text-[30px]" />
              </span>
            </div>

            <div>
              <p className="mb-1 text-[15px] font-bold text-ink-dim">{t("इस बैग में डालें", "Put into this bag")}</p>
              <ul className="flex flex-col divide-y divide-line rounded-2xl bg-elevated px-3 py-1">
                {items.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-3 py-2 text-[17px]">
                    <span className="min-w-0 truncate">{nameOf(item.productId)}</span>
                    <b className="shrink-0 font-display text-xl">{num(item.pieces)}</b>
                  </li>
                ))}
                {items.length > 1 && (
                  <li className="flex items-center justify-between gap-3 py-2 text-base font-extrabold">
                    <span>{t("कुल", "Total")}</span>
                    <span>
                      {num(adding)} {t("पीस", "pcs")}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <p className="flex items-baseline justify-between gap-3 text-[15px] text-ink-dim">
              <span>{t("बैग में अब कुल", "Now in the bag")}</span>
              <b className="font-display text-xl text-ink">
                {num(bag.pieceCount)} {t("पीस", "pcs")}
              </b>
            </p>

            {!tied && can("tieSend") && (
              <button
                type="button"
                onClick={() => tieBag(bag.id)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-pile-line px-3 py-2 text-[15px] font-bold text-pile-soft hover:bg-pile-tint"
              >
                <SackIcon size={20} className="shrink-0" />
                {t("बैग भर गया? मुँह बाँधें", "Bag full? Tie it")}
              </button>
            )}
            {tied && (
              <p className="flex items-center gap-2 rounded-xl bg-pile px-3 py-2 text-base font-bold text-pile-ink">
                <SackIcon size={20} className="shrink-0" />
                {t("बैग बँध चुका — फैक्ट्री के लिए तैयार", "Bag is tied — ready for the factory")}
              </p>
            )}

            <button
              type="button"
              onClick={() => toggle(bag.id)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-money font-display text-lg font-extrabold text-money hover:bg-money-tint"
            >
              <CheckIcon size={22} />
              {t("डाल दिया", "Put in")}
            </button>
          </section>
        );
      })}

      {cards.length > 1 && (
        <p className={cn("text-center text-[15px] font-bold", allDone ? "text-money" : "text-ink-dim")}>
          {allDone ? t("✓ सारा माल बैग में", "✓ Everything is in its bag") : t(`हो गया: ${done.length} / ${cards.length} बैग`, `Done: ${done.length} of ${cards.length} bags`)}
        </p>
      )}

      <button type="button" onClick={() => window.print()} className={softButton}>
        <PrinterIcon size={22} />
        {t(`${cards.length} बैग के स्टिकर छापें`, `Print stickers for ${cards.length} bag${cards.length > 1 ? "s" : ""}`)}
      </button>

      <PrintSheet>
        {cards.map(({ bag }) => (
          <PrintLabel
            key={bag.id}
            number={bag.bagNumber}
            lines={[
              `${company?.name ?? ""} · MRP ₹${bag.mrp}`,
              (bag.items ?? []).map((i) => `${nameOf(i.productId)} ${num(i.pieces)}`).join(" · "),
              `${num(bag.pieceCount)} pcs${bag.own?.pieces ? ` · own godown ${num(bag.own.pieces)}` : ""}`,
            ]}
          />
        ))}
      </PrintSheet>
    </>
  );
}
