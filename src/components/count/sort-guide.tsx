"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { speak, useCanSpeak } from "@/lib/device";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { BAG_CAPACITY, NEAR_FULL, pilesOf } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MrpCircle } from "@/components/ft/brand";
import { ArrowRightIcon, SackIcon, SpeakerIcon } from "@/components/ft/icons";
import { BigButton, BigLink, PileBar, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";

/**
 * Straight after counting: which pile each MRP goes on, and whether a
 * pile is now full enough to tie a 700-piece bag.
 */
export function SortGuide({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const { t, lang } = useLang();
  const { collections, companies, countLines, tieFullBags } = useStore();
  const speakable = useCanSpeak();
  const { can } = useSession();
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

  const mine = countLines.filter((l) => l.collectionId === bag.id);
  const counted = mine.reduce((s, l) => s + l.quantity, 0);
  const piles = pilesOf(countLines, company.id);

  const rows = Array.from(new Set(mine.filter((l) => !l.packed).map((l) => l.mrp)))
    .map((mrp) => {
      const adding = mine.filter((l) => l.mrp === mrp && !l.packed).reduce((s, l) => s + l.quantity, 0);
      const pile = piles.find((p) => p.mrp === mrp)?.pieces ?? adding;
      const before = pile - adding;
      return { mrp, adding, before, total: pile, fullBags: Math.floor(pile / BAG_CAPACITY), left: pile % BAG_CAPACITY };
    })
    // Full piles first: those need hands right now.
    .sort((a, b) => b.fullBags - a.fullBags || BAG_CAPACITY - (a.total % BAG_CAPACITY) - (BAG_CAPACITY - (b.total % BAG_CAPACITY)));

  const full = rows.filter((r) => r.fullBags > 0);
  const bagsToTie = full.reduce((s, r) => s + r.fullBags, 0);
  const shortNumber = bag.bagNumber.replace(/-\d{4}-/, "-");

  function listen() {
    const parts = rows.map((r) =>
      lang === "hi"
        ? `${r.mrp} रुपये वाले ${r.adding} पीस, ${r.mrp} रुपये के ढेर में डालें।${r.fullBags ? ` यह ढेर भर गया, ${r.fullBags} बैग बाँधो।` : ""}`
        : `Put ${r.adding} pieces of ${r.mrp} rupees on the ${r.mrp} rupee pile.${r.fullBags ? ` That pile is full, tie ${r.fullBags} bag.` : ""}`
    );
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
        tone="money"
        kicker={`✓ ${num(counted)} ${t("पीस गिने", "pieces counted")} · ${shortNumber}`}
        aside={
          speakable ? (
            <button type="button" onClick={listen} aria-label={t("निर्देश सुनें", "Listen to instructions")} className="flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-pile-tint px-3 text-[15px] font-bold text-pile-soft">
              <SpeakerIcon size={22} />
              {t("सुनें", "Listen")}
            </button>
          ) : undefined
        }
      >
        <h1 className="font-display text-2xl font-extrabold leading-[1.15]">{t("अब छँटाई करें", "Now sort the pieces")}</h1>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        <p className="text-base leading-[1.35] text-ink-soft">
          {lang === "hi" ? (
            <>
              हर MRP का माल <b className="text-pile-soft">उसी MRP के ढेर</b> में डालें। {BAG_CAPACITY} पीस होते ही बैग बाँधें।
              <br />
              <span className="text-sm text-ink-faint">
                Put each MRP into its own {company.name} pile. Tie a bag at {BAG_CAPACITY}.
              </span>
            </>
          ) : (
            <>
              Put each MRP into <b className="text-pile-soft">its own {company.name} pile</b>. Tie a bag at {BAG_CAPACITY}.
              <br />
              <span className="text-sm text-ink-faint">हर MRP का माल उसी MRP के ढेर में डालें।</span>
            </>
          )}
        </p>

        {rows.map((row) => {
          const isFull = row.fullBags > 0;
          const need = BAG_CAPACITY - row.total;
          return (
            <section key={row.mrp} className={cn("rounded-[20px] p-3.5", isFull ? "border-2 border-pile bg-pile-deep" : "border border-line bg-surface")}>
              <div className="flex items-center gap-3">
                <MrpCircle mrp={row.mrp} size={60} />
                <span className="flex-1">
                  <span className="block text-[15px] text-ink-dim">
                    {t("इस बैग से डालें", "Put in from this bag")} · {lang === "hi" ? "Put in" : "इस बैग से डालें"}
                  </span>
                  <span className="block font-display text-[30px] font-extrabold leading-none">
                    {num(row.adding)} {t("पीस", "pcs")}
                  </span>
                </span>
              </div>
              <div className="mt-3">
                <PileBar
                  existing={Math.min(row.before, BAG_CAPACITY)}
                  adding={row.adding}
                  capacity={BAG_CAPACITY}
                  height={22}
                  label={`${row.before} already, ${row.adding} from this bag, of ${BAG_CAPACITY}`}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-sm text-ink-dim">
                <span>{isFull ? `${t("पहले", "Before")} ${num(row.before)}` : `${t("ढेर अब", "Pile now")} ${num(row.total)}`}</span>
                <span>{BAG_CAPACITY}</span>
              </div>
              {isFull ? (
                <p className="mt-2 rounded-xl bg-pile px-2.5 py-2 text-base font-bold text-pile-ink">
                  {t(`ढेर भर गया! ${row.fullBags} बैग बाँधो`, `Pile full! Tie ${row.fullBags} bag${row.fullBags > 1 ? "s" : ""}`)} ·{" "}
                  {row.left
                    ? t(`${num(row.left)} पीस ढेर में बचेंगे`, `${num(row.left)} stay in the pile`)
                    : t("ढेर पूरा ख़ाली हो जाएगा", "the pile empties exactly")}
                </p>
              ) : need <= NEAR_FULL ? (
                <p className="mt-2 text-base font-bold text-count-soft">{t(`लगभग भरा — सिर्फ़ ${need} और चाहिए`, `Almost full — only ${need} more`)}</p>
              ) : (
                <p className="mt-2 text-base font-semibold text-ink-dim">
                  {num(need)} {t("और चाहिए", "more needed")} · {lang === "hi" ? `needs ${num(need)} more` : `${num(need)} और चाहिए`}
                </p>
              )}
            </section>
          );
        })}
      </ScreenBody>

      <ScreenFooter>
        {bagsToTie > 0 && can("tieSend") ? (
          <>
            <BigButton tone="pile" onClick={tie} className="text-[21px]">
              <SackIcon />
              {full.length === 1
                ? t(`₹${full[0].mrp} ${bagsToTie > 1 ? "के" : "का"} ${bagsToTie} बैग बाँधो · Tie ${bagsToTie} bag${bagsToTie > 1 ? "s" : ""}`, `Tie ${bagsToTie} ₹${full[0].mrp} bag${bagsToTie > 1 ? "s" : ""}`)
                : t(`${bagsToTie} बैग बाँधो · Tie ${bagsToTie} bags`, `Tie ${bagsToTie} bags`)}
            </BigButton>
            <Link href="/count" className="flex h-11 items-center justify-center text-base font-bold text-ink-dim">
              {t("बाद में बाँधेंगे · Later", "Later · बाद में बाँधेंगे")}
            </Link>
          </>
        ) : (
          <>
            <BigLink tone="count" href="/count">
              {t("अगला बैग गिनें · Count next bag", "Count next bag · अगला बैग गिनें")}
              <ArrowRightIcon />
            </BigLink>
            <Link href={`/piles?company=${company.id}`} className="flex h-11 items-center justify-center text-base font-bold text-ink-dim">
              {t("सारे ढेर देखें", "See all piles")}
            </Link>
          </>
        )}
      </ScreenFooter>
    </Screen>
  );
}
