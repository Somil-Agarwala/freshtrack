"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { speak, useCanSpeak } from "@/lib/device";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { BAG_CAPACITY, NEAR_FULL, pilesOf } from "@/lib/pipeline";
import { findPlace, pileCode } from "@/lib/places";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MrpCircle } from "@/components/ft/brand";
import { ArrowRightIcon, CheckIcon, PrinterIcon, SackIcon, SpeakerIcon } from "@/components/ft/icons";
import { EmptyCard } from "@/components/ft/kit";
import { BigButton, BigLink, PileBar, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";
import { PileTag, PlaceDialog, PlaceLine, usePlacards } from "@/components/piles/pile-place";

/**
 * Straight after counting: where in the godown each part of this bag goes.
 * One card per pile it feeds -- the placard to look for (HLD-10), where that
 * pile stands, exactly which items and how many go on it, and what the pile
 * becomes. Staff tick each pile off as they put the goods down.
 */
export function SortGuide({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const { t, lang } = useLang();
  const { collections, companies, distributors, countLines, products, pilePlaces, tieFullBags } = useStore();
  const speakable = useCanSpeak();
  const { can } = useSession();
  const placards = usePlacards();
  const [placed, setPlaced] = useState<number[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const bag = collections.find((c) => c.id === collectionId);
  const company = companies.find((c) => c.id === bag?.companyId);

  if (!bag || !company) {
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

  const party = distributors.find((d) => d.id === bag.distributorId);
  const mine = countLines.filter((l) => l.collectionId === bag.id);
  const counted = mine.reduce((s, l) => s + l.quantity, 0);
  const loose = mine.filter((l) => !l.packed);
  const piles = pilesOf(countLines, company.id);
  const nameOf = (productId: string) => products.find((p) => p.id === productId)?.name ?? "—";

  const rows = Array.from(new Set(loose.map((l) => l.mrp)))
    .map((mrp) => {
      // Lines split when a bag fills part-way, so merge them back per item.
      const items = Array.from(
        loose.filter((l) => l.mrp === mrp).reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>())
      )
        .map(([productId, pieces]) => ({ productId, pieces }))
        .sort((a, b) => b.pieces - a.pieces);
      const adding = items.reduce((s, i) => s + i.pieces, 0);
      const total = piles.find((p) => p.mrp === mrp)?.pieces ?? adding;
      return {
        mrp,
        items,
        adding,
        before: total - adding,
        total,
        fullBags: Math.floor(total / BAG_CAPACITY),
        left: total % BAG_CAPACITY,
        where: findPlace(pilePlaces, company.id, mrp)?.where,
      };
    })
    // Walking order: piles in the same corner of the godown together, then by MRP.
    .sort((a, b) => (a.where ?? "￿").localeCompare(b.where ?? "￿") || a.mrp - b.mrp);

  const full = rows.filter((r) => r.fullBags > 0);
  const bagsToTie = full.reduce((s, r) => s + r.fullBags, 0);
  const done = rows.filter((r) => placed.includes(r.mrp)).length;
  const allPlaced = rows.length > 0 && done === rows.length;
  const shortNumber = bag.bagNumber.replace(/-\d{4}-/, "-");
  const canArrange = can("tieSend");

  const toggle = (mrp: number) => setPlaced((prev) => (prev.includes(mrp) ? prev.filter((m) => m !== mrp) : [...prev, mrp]));

  function listen() {
    const parts = rows.map((r) => {
      const code = pileCode(company, r.mrp);
      const what = r.items.map((i) => `${nameOf(i.productId)} ${i.pieces}`).join(", ");
      return lang === "hi"
        ? `${code} वाले ढेर पर ${r.adding} पीस रखें: ${what}।${r.where ? ` जगह: ${r.where}।` : ""}${r.fullBags ? ` यह ढेर भर गया, ${r.fullBags} बैग बाँधो।` : ""}`
        : `Put ${r.adding} pieces on pile ${code}: ${what}.${r.where ? ` It is at ${r.where}.` : ""}${r.fullBags ? ` That pile is full, tie ${r.fullBags} bag.` : ""}`;
    });
    speak(parts.join(" "), lang);
  }

  function tie() {
    const created = tieFullBags(company!.id, full.map((r) => r.mrp));
    if (created.length) router.push(`/piles/tied?ids=${created.map((b) => b.id).join(",")}`);
  }

  return (
    <Screen>
      <TaskHeader
        back={`/count/${bag.id}`}
        tone="pile"
        kicker={`✓ ${num(counted)} ${t("पीस गिने", "pieces counted")} · ${shortNumber}${party ? ` · ${party.name}` : ""}`}
        aside={
          speakable && rows.length > 0 ? (
            <button type="button" onClick={listen} aria-label={t("निर्देश सुनें", "Listen to instructions")} className="flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-pile-tint px-3 text-[15px] font-bold text-pile-soft">
              <SpeakerIcon size={22} />
              {t("सुनें", "Listen")}
            </button>
          ) : undefined
        }
      >
        <h1 className="font-display text-2xl font-extrabold leading-[1.15]">{t("माल कहाँ रखें", "Where to put the goods")}</h1>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        {rows.length === 0 ? (
          <EmptyCard
            title={t("इस बैग का सारा माल बैग में बँध चुका है", "Everything from this bag is already tied into bags")}
            detail={t("रखने को कुछ नहीं बचा", "Nothing left to put away")}
          />
        ) : (
          <p className="text-base leading-[1.35] text-ink-soft">
            {lang === "hi" ? (
              <>
                हर ढेर पर उसकी <b className="text-pile-soft">पर्ची</b> लगी है (जैसे {pileCode(company, rows[0].mrp)})। नीचे लिखा माल उसी पर्ची वाले ढेर पर रखें, फिर <b>✓</b> दबाएँ।
                <br />
                <span className="text-sm text-ink-faint">Every pile carries its placard. Put each lot on the pile with that placard, then tap ✓.</span>
              </>
            ) : (
              <>
                Every pile carries its <b className="text-pile-soft">placard</b> (like {pileCode(company, rows[0].mrp)}). Put each lot below on the pile with that placard, then tap <b>✓</b>.
                <br />
                <span className="text-sm text-ink-faint">हर ढेर पर उसकी पर्ची लगी है। माल उसी पर्ची वाले ढेर पर रखें।</span>
              </>
            )}
          </p>
        )}

        {rows.map((row) => {
          const code = pileCode(company, row.mrp);

          if (placed.includes(row.mrp)) {
            return (
              <button
                key={row.mrp}
                type="button"
                onClick={() => toggle(row.mrp)}
                className="flex items-center gap-3 rounded-[20px] border border-money-line bg-money-tint px-3.5 py-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-money text-money-ink">
                  <CheckIcon size={20} />
                </span>
                <PileTag company={company} mrp={row.mrp} size="sm" />
                <span className="min-w-0 flex-1 truncate text-base font-bold text-money-note">
                  {num(row.adding)} {t("पीस रख दिए", "pcs put away")}
                </span>
                <span className="shrink-0 text-sm font-bold text-money-mute">{t("वापस खोलें", "Undo")}</span>
              </button>
            );
          }

          const isFull = row.fullBags > 0;
          const need = BAG_CAPACITY - row.total;
          return (
            <section key={row.mrp} className={cn("flex flex-col gap-3 rounded-[20px] p-3.5", isFull ? "border-2 border-pile bg-pile-deep" : "border border-line bg-surface")}>
              <div className="flex items-center gap-3">
                <MrpCircle mrp={row.mrp} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-ink-dim">{t("इस पर्ची वाले ढेर पर रखें", "Put on the pile with this placard")}</span>
                  <PileTag company={company} mrp={row.mrp} size="lg" className="mt-1" />
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-[28px] font-extrabold leading-none">{num(row.adding)}</span>
                  <span className="text-sm text-ink-dim">{t("पीस", "pcs")}</span>
                </span>
              </div>

              <PlaceLine where={row.where} onEdit={canArrange ? () => setEditing(row.mrp) : undefined} />

              {row.before === 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-count-tint px-3 py-2">
                  <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-count-note">
                    {t(`अभी कोई ${code} ढेर नहीं — नया ढेर शुरू करें और पर्ची लगाएँ`, `No ${code} pile yet — start one and put up its placard`)}
                  </p>
                  <button
                    type="button"
                    onClick={() => placards.print([{ companyId: company.id, mrp: row.mrp }])}
                    aria-label={t(`${code} की पर्ची छापें`, `Print the ${code} placard`)}
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-count px-3 text-sm font-extrabold text-count-ink"
                  >
                    <PrinterIcon size={18} />
                    {t("पर्ची", "Placard")}
                  </button>
                </div>
              )}

              <ul className="flex flex-col divide-y divide-line rounded-2xl bg-elevated px-3 py-1">
                {row.items.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-3 py-2 text-base">
                    <span className="min-w-0 truncate">{nameOf(item.productId)}</span>
                    <b className="shrink-0">{num(item.pieces)}</b>
                  </li>
                ))}
                {row.items.length > 1 && (
                  <li className="flex items-center justify-between gap-3 py-2 text-base font-extrabold">
                    <span>{t("कुल", "Total")}</span>
                    <span>
                      {num(row.adding)} {t("पीस", "pcs")}
                    </span>
                  </li>
                )}
              </ul>

              <div>
                <PileBar
                  existing={Math.min(row.before, BAG_CAPACITY)}
                  adding={row.adding}
                  capacity={BAG_CAPACITY}
                  height={20}
                  label={`${row.before} already, ${row.adding} from this bag, of ${BAG_CAPACITY}`}
                />
                <div className="mt-1.5 flex justify-between text-sm text-ink-dim">
                  <span>
                    {t("पहले", "Before")} {num(row.before)} → {t("अब", "now")} <b className="text-ink">{num(row.total)}</b>
                  </span>
                  <span>{BAG_CAPACITY}</span>
                </div>
              </div>

              {isFull ? (
                <p className="rounded-xl bg-pile px-2.5 py-2 text-base font-bold text-pile-ink">
                  {t(`ढेर भर गया! ${row.fullBags} बैग बाँधो`, `Pile full! Tie ${row.fullBags} bag${row.fullBags > 1 ? "s" : ""}`)} ·{" "}
                  {row.left
                    ? t(`${num(row.left)} पीस ढेर में बचेंगे`, `${num(row.left)} stay in the pile`)
                    : t("ढेर पूरा ख़ाली हो जाएगा", "the pile empties exactly")}
                </p>
              ) : need <= NEAR_FULL ? (
                <p className="text-base font-bold text-count-soft">{t(`लगभग भरा — सिर्फ़ ${need} और चाहिए`, `Almost full — only ${need} more`)}</p>
              ) : (
                <p className="text-base font-semibold text-ink-dim">
                  {t(`बैग के लिए ${num(need)} और चाहिए`, `${num(need)} more for a bag`)}
                </p>
              )}

              <button
                type="button"
                onClick={() => toggle(row.mrp)}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-money bg-transparent font-display text-lg font-extrabold text-money hover:bg-money-tint"
              >
                <CheckIcon size={22} />
                {t(`${code} पर रख दिया`, `Put on ${code}`)}
              </button>
            </section>
          );
        })}
      </ScreenBody>

      <ScreenFooter>
        {rows.length > 1 && (
          <p className={cn("text-center text-[15px] font-bold", allPlaced ? "text-money" : "text-ink-dim")}>
            {allPlaced ? t("✓ सारा माल रख दिया", "✓ Everything put away") : t(`रखा: ${done} / ${rows.length} ढेर`, `Put away: ${done} of ${rows.length} piles`)}
          </p>
        )}
        {bagsToTie > 0 && can("tieSend") ? (
          <>
            <BigButton tone="pile" onClick={tie} className="text-[21px]">
              <SackIcon />
              {full.length === 1
                ? t(`${pileCode(company, full[0].mrp)} से ${bagsToTie} बैग बाँधो`, `Tie ${bagsToTie} bag${bagsToTie > 1 ? "s" : ""} from ${pileCode(company, full[0].mrp)}`)
                : t(`${bagsToTie} बैग बाँधो`, `Tie ${bagsToTie} bags`)}
            </BigButton>
            <Link href="/count" className="flex h-11 items-center justify-center text-base font-bold text-ink-dim">
              {t("बाद में बाँधेंगे · अगला बैग गिनें", "Tie later · count the next bag")}
            </Link>
          </>
        ) : (
          <>
            <BigLink tone="count" href="/count">
              {t("अगला बैग गिनें", "Count the next bag")}
              <ArrowRightIcon />
            </BigLink>
            <Link href={`/piles?company=${company.id}`} className="flex h-11 items-center justify-center text-base font-bold text-ink-dim">
              {t("सारे ढेर देखें", "See all piles")}
            </Link>
          </>
        )}
      </ScreenFooter>

      {editing !== null && (
        <PlaceDialog companyId={company.id} mrp={editing} onClose={() => setEditing(null)} onPrint={() => placards.print([{ companyId: company.id, mrp: editing }])} />
      )}
      {placards.sheet}
    </Screen>
  );
}
