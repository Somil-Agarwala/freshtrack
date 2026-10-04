"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { bagContents, pilesOf } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { CompanyAvatar, MrpChip, MrpCircle } from "@/components/ft/brand";
import { ArrowRightIcon, LayersIcon, PrinterIcon, SackIcon } from "@/components/ft/icons";
import { PrintLabel, PrintSheet } from "@/components/ft/print-sheet";
import { BigLink, Screen, ScreenBody, ScreenFooter, softButton } from "@/components/ft/screen";

/** Bag(s) just tied: the label to write or stick on each. */
export function BagTied() {
  const { t, sub } = useLang();
  const { sortedBags, companies, countLines, collections, distributors } = useStore();
  // Whose goods are in a bag. Money is tracked per dispatch, not per bag.
  const partiesIn = (bag: (typeof sortedBags)[number]) => {
    const names = Array.from(
      new Set(
        bagContents(bag, countLines)
          .map((c) => collections.find((x) => x.id === c.collectionId)?.distributorId)
          .map((id) => distributors.find((d) => d.id === id)?.name)
          .filter((n): n is string => !!n)
      )
    );
    return names.length ? `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ""}` : "—";
  };
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean);
  const bags = ids.map((id) => sortedBags.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b);

  if (bags.length === 0) {
    return (
      <Screen>
        <ScreenBody className="items-center justify-center">
          <Link href="/piles" className="font-bold text-pile">
            {t("ढेर देखें", "See piles")}
          </Link>
        </ScreenBody>
      </Screen>
    );
  }

  const company = companies.find((c) => c.id === bags[0].companyId);
  const piles = pilesOf(countLines, bags[0].companyId);
  const mrps = Array.from(new Set(bags.map((b) => b.mrp)));

  return (
    <Screen>
      <ScreenBody className="gap-4 pt-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-pile text-pile-ink">
            <SackIcon size={44} />
          </span>
          <h1 className="font-display text-[30px] font-extrabold leading-[1.1]">
            {bags.length === 1 ? t("बैग बँध गया!", "Bag tied!") : t(`${bags.length} बैग बँध गए!`, `${bags.length} bags tied!`)}
          </h1>
          <p className="text-base text-ink-dim">{bags.length === 1 ? t("Bag tied · ready for the factory", "फैक्ट्री के लिए तैयार") : t("Bags tied · ready for the factory", "फैक्ट्री के लिए तैयार")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {bags.map((bag) => (
            <div key={bag.id} className="flex flex-col gap-3 rounded-[20px] border-[3px] border-dashed border-pile bg-white p-[18px] text-[#111418]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[17px] font-bold">
                  <CompanyAvatar company={company} size={36} />
                  {company?.name}
                </span>
                <MrpChip mrp={bag.mrp} prefix="MRP " className="px-3 py-1 font-display text-lg" />
              </div>
              <p className="text-center font-mono text-[29px] font-semibold tracking-[0.5px] max-[380px]:text-2xl">{bag.bagNumber}</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-[#F1F2F5] p-2">
                  <p className="text-[13px] text-[#4A5260]">पीस · Pieces</p>
                  <p className="font-display text-2xl font-extrabold">{num(bag.pieceCount)}</p>
                </div>
                <div className="min-w-0 rounded-xl bg-[#F1F2F5] p-2">
                  <p className="text-[13px] text-[#4A5260]">किसका माल · From</p>
                  <p className="truncate pt-1 text-base font-bold">{partiesIn(bag)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-base leading-[1.35] text-ink-soft">
          <b>{t("यह नंबर बैग पर लिखें या स्टिकर लगाएँ।", "Write this number on the bag or stick the label.")}</b>
          <br />
          <span className="text-sm text-ink-faint">{sub("यह नंबर बैग पर लिखें या स्टिकर लगाएँ।", "Write this number on the bag or stick the label.")}</span>
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => window.print()} className={softButton}>
            <PrinterIcon size={22} />
            {t("स्टिकर छापें", "Print labels")}
          </button>
          <Link href={`/piles?company=${bags[0].companyId}`} className={softButton}>
            <LayersIcon size={22} />
            {t("सारे ढेर देखें", "See all piles")}
          </Link>
        </div>

        {mrps.map((mrp) => {
          const left = piles.find((p) => p.mrp === mrp)?.pieces ?? 0;
          return (
            <div key={mrp} className="flex items-center gap-2.5 rounded-[14px] bg-surface px-3.5 py-3 text-[15px] text-ink-dim">
              <MrpCircle mrp={mrp} size={30} />
              {left > 0
                ? t(`₹${mrp} के ढेर में अभी ${num(left)} पीस बचे हैं`, `${num(left)} pieces still in the ₹${mrp} pile`)
                : t(`₹${mrp} का ढेर खाली हो गया`, `The ₹${mrp} pile is empty now`)}
            </div>
          );
        })}
      </ScreenBody>

      <ScreenFooter>
        <BigLink tone="count" href="/count">
          {t("अगला बैग गिनें · Count next bag", "Count next bag · अगला बैग गिनें")}
          <ArrowRightIcon />
        </BigLink>
      </ScreenFooter>

      <PrintSheet>
        {bags.map((bag) => (
          <PrintLabel key={bag.id} number={bag.bagNumber} lines={[`${company?.name} · MRP ₹${bag.mrp}`, `${num(bag.pieceCount)} pcs · ${partiesIn(bag)}`]} />
        ))}
      </PrintSheet>
    </Screen>
  );
}
