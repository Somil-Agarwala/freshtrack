"use client";

import Link from "next/link";
import { useState } from "react";
import { speak, useCanSpeak } from "@/lib/device";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { BAG_CAPACITY } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MrpCircle } from "@/components/ft/brand";
import { ArrowRightIcon, CheckIcon, PrinterIcon, SackIcon, SpeakerIcon } from "@/components/ft/icons";
import { EmptyCard } from "@/components/ft/kit";
import { PrintLabel, PrintSheet } from "@/components/ft/print-sheet";
import { BigLink, PileBar, Screen, ScreenBody, ScreenFooter, TaskHeader, softButton } from "@/components/ft/screen";

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

/**
 * Straight after counting: the numbered bags this pickup's goods go into.
 * Pieces were put into bags the moment the count was saved -- the open bag
 * of each MRP topped up, a new numbered bag opened when one filled -- so
 * this screen only has to say, bag by bag: this number, these items, this
 * many pieces. Staff write new numbers on fresh bags, fill them, tick each.
 */
export function SortGuide({ collectionId }: { collectionId: string }) {
  const { t, lang } = useLang();
  const { collections, companies, distributors, countLines, products, sortedBags } = useStore();
  const speakable = useCanSpeak();
  const [done, setDone] = useState<string[]>([]);
  const pickup = collections.find((c) => c.id === collectionId);
  const company = companies.find((c) => c.id === pickup?.companyId);

  if (!pickup || !company) {
    return (
      <Screen>
        <ScreenBody className="items-center justify-center">
          <Link href="/count" className="font-bold text-count">
            {t("गिनती की सूची देखें", "Back to the count list")}
          </Link>
        </ScreenBody>
      </Screen>
    );
  }

  const party = distributors.find((d) => d.id === pickup.distributorId);
  const mine = countLines.filter((l) => l.collectionId === pickup.id);
  const counted = mine.reduce((s, l) => s + l.quantity, 0);
  const nameOf = (productId: string) => products.find((p) => p.id === productId)?.name ?? "—";

  const cards = Array.from(new Set(mine.map((l) => l.bagId).filter((id): id is string => !!id)))
    .map((bagId) => sortedBags.find((b) => b.id === bagId))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .map((bag) => {
      const here = mine.filter((l) => l.bagId === bag.id);
      // Lines that spill into the next bag are split, so merge per item.
      const items = Array.from(here.reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>()))
        .map(([productId, pieces]) => ({ productId, pieces }))
        .sort((a, b) => b.pieces - a.pieces);
      const adding = items.reduce((s, i) => s + i.pieces, 0);
      return { bag, items, adding, before: bag.pieceCount - adding, isNew: bag.openedFor === pickup.id, full: bag.pieceCount >= BAG_CAPACITY };
    })
    .sort((a, b) => a.bag.mrp - b.bag.mrp || a.bag.bagNumber.localeCompare(b.bag.bagNumber));

  const newBags = cards.filter((c) => c.isNew).length;
  const fullBags = cards.filter((c) => c.full).length;
  const allDone = cards.length > 0 && cards.every((c) => done.includes(c.bag.id));
  const shortNumber = pickup.bagNumber.replace(/-\d{4}-/, "-");
  const toggle = (id: string) => setDone((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function listen() {
    const parts = cards.map(({ bag, items, isNew, full }) => {
      const what = items.map((i) => `${nameOf(i.productId)} ${i.pieces}`).join(", ");
      return lang === "hi"
        ? `${isNew ? "नया बैग लें, उस पर नंबर लिखें" : "पहले से खुला बैग"} ${bag.bagNumber}। इसमें डालें: ${what}।${full ? " बैग भर गया, मुँह बाँध दें।" : ""}`
        : `${isNew ? "Take a new bag and write" : "Open bag"} ${bag.bagNumber}. Put in: ${what}.${full ? " The bag is full, tie it." : ""}`;
    });
    speak(parts.join(" "), lang);
  }

  return (
    <Screen>
      <TaskHeader
        back={`/collections/${pickup.id}`}
        tone="pile"
        kicker={`✓ ${num(counted)} ${t("पीस गिने", "pieces counted")} · ${shortNumber}${party ? ` · ${party.name}` : ""}`}
        aside={
          speakable && cards.length > 0 ? (
            <button type="button" onClick={listen} aria-label={t("निर्देश सुनें", "Listen to instructions")} className="flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-pile-tint px-3 text-[15px] font-bold text-pile-soft">
              <SpeakerIcon size={22} />
              {t("सुनें", "Listen")}
            </button>
          ) : undefined
        }
      >
        <h1 className="font-display text-2xl font-extrabold leading-[1.15]">{t("किस बैग में क्या डालें", "What goes in which bag")}</h1>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        {cards.length === 0 ? (
          <EmptyCard title={t("इस बैग में कुछ नहीं गिना गया", "Nothing was counted in this bag")} />
        ) : (
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
        )}

        {cards.map(({ bag, items, adding, before, isNew, full }) => {
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
                    {full && ` · ${t("बाँध दिया", "tied")}`}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-money-mute">{t("वापस खोलें", "Undo")}</span>
              </button>
            );
          }

          return (
            <section key={bag.id} className={cn("flex flex-col gap-3 rounded-[20px] p-3.5", full ? "border-2 border-pile bg-pile-deep" : "border border-line bg-surface")}>
              <div className="flex items-start gap-3">
                <MrpCircle mrp={bag.mrp} size={52} />
                <span className="min-w-0 flex-1">
                  <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[13px] font-extrabold", isNew ? "bg-count text-count-ink" : "bg-pile-tint text-pile-soft")}>
                    {isNew ? t("नया बैग — यह नंबर लिखें", "New bag — write this number") : t(`पहले से खुला बैग · ${num(before)} पीस`, `Already open · ${num(before)} pcs in it`)}
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

              <div>
                <PileBar existing={before} adding={adding} capacity={BAG_CAPACITY} height={20} label={`${before} already, ${adding} from this pickup, of ${BAG_CAPACITY}`} />
                <div className="mt-1.5 flex justify-between text-sm text-ink-dim">
                  <span>
                    {t("बैग में अब", "Bag now")} <b className="text-ink">{num(bag.pieceCount)}</b>
                  </span>
                  <span>{BAG_CAPACITY}</span>
                </div>
              </div>

              {full ? (
                <p className="flex items-center gap-2 rounded-xl bg-pile px-3 py-2 text-base font-bold text-pile-ink">
                  <SackIcon size={20} className="shrink-0" />
                  {t(`बैग भर गया (${BAG_CAPACITY}) — मुँह बाँध दें, फैक्ट्री के लिए तैयार`, `Bag full (${BAG_CAPACITY}) — tie it, it is ready for the factory`)}
                </p>
              ) : (
                <p className="text-base font-semibold text-ink-dim">
                  {t(`बैग खुला रखें — ${num(BAG_CAPACITY - bag.pieceCount)} पीस और आएँगे`, `Keep the bag open — ${num(BAG_CAPACITY - bag.pieceCount)} more pieces will go in`)}
                </p>
              )}

              <button
                type="button"
                onClick={() => toggle(bag.id)}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-money font-display text-lg font-extrabold text-money hover:bg-money-tint"
              >
                <CheckIcon size={22} />
                {full ? t("डाल दिया और बाँध दिया", "Put in and tied") : t("डाल दिया", "Put in")}
              </button>
            </section>
          );
        })}

        {cards.length > 0 && (
          <button type="button" onClick={() => window.print()} className={softButton}>
            <PrinterIcon size={22} />
            {t(`${cards.length} बैग के स्टिकर छापें`, `Print stickers for ${cards.length} bag${cards.length > 1 ? "s" : ""}`)}
          </button>
        )}
      </ScreenBody>

      <ScreenFooter>
        {cards.length > 1 && (
          <p className={cn("text-center text-[15px] font-bold", allDone ? "text-money" : "text-ink-dim")}>
            {allDone ? t("✓ सारा माल बैग में", "✓ Everything is in its bag") : t(`हो गया: ${done.length} / ${cards.length} बैग`, `Done: ${done.length} of ${cards.length} bags`)}
            {fullBags > 0 && !allDone && ` · ${t(`${fullBags} बैग भरे`, `${fullBags} full`)}`}
          </p>
        )}
        <BigLink tone="count" href="/count">
          {t("अगला बैग गिनें", "Count the next bag")}
          <ArrowRightIcon />
        </BigLink>
        <Link href={`/piles?company=${company.id}`} className="flex h-11 items-center justify-center text-base font-bold text-ink-dim">
          {t("सारे खुले बैग देखें", "See all open bags")}
        </Link>
      </ScreenFooter>

      <PrintSheet>
        {cards.map(({ bag }) => (
          <PrintLabel
            key={bag.id}
            number={bag.bagNumber}
            lines={[`${company.name} · MRP ₹${bag.mrp}`, (bag.items ?? []).map((i) => `${nameOf(i.productId)} ${num(i.pieces)}`).join(" · "), `${num(bag.pieceCount)} / ${BAG_CAPACITY} pcs`]}
          />
        ))}
      </PrintSheet>
    </Screen>
  );
}
