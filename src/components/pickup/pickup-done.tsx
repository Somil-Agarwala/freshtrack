"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { shareOnWhatsApp } from "@/lib/device";
import { fullDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { ArrowRightIcon, CheckIcon, InfoIcon, PrinterIcon, WhatsAppIcon } from "@/components/ft/icons";
import { PrintLabel, PrintSheet } from "@/components/ft/print-sheet";
import { BigLink, Note, Screen, ScreenBody, ScreenFooter, softButton } from "@/components/ft/screen";
import { MissingStep } from "./pickup-party";

/** Pickup saved: the numbers to write on each bag. */
export function PickupDone() {
  const { t, lang } = useLang();
  const { collections, companies, distributors } = useStore();
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean);
  const bags = ids.map((id) => collections.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);

  if (bags.length === 0) return <MissingStep />;
  const company = companies.find((c) => c.id === bags[0].companyId);
  const party = distributors.find((d) => d.id === bags[0].distributorId);
  const date = fullDate(bags[0].collectedDate, lang);

  const share = () =>
    shareOnWhatsApp(
      [`${company?.name} · ${party?.name} · ${date}`, `${bags.length} ${t("बैग", "bags")}:`, ...bags.map((b, i) => `${i + 1}. ${b.bagNumber}`)].join("\n")
    );

  return (
    <Screen>
      <ScreenBody className="gap-4 pt-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-money text-money-ink">
            <CheckIcon size={44} strokeWidth={3} />
          </span>
          <h1 className="font-display text-[30px] font-extrabold leading-[1.1]">
            {t(`हो गया! ${bags.length} बैग दर्ज`, `Done! ${bags.length} ${bags.length === 1 ? "bag" : "bags"} saved`)}
          </h1>
          <p className="text-base text-ink-dim">
            {t("Saved", "दर्ज हो गया")} · {company?.name} · {party?.name}
          </p>
        </div>

        <Note tone="count" bold icon={<InfoIcon size={22} />} hi="हर बैग पर उसका नंबर मार्कर से लिखें।" en="Write each number on its bag with a marker." className="text-base" />

        <div className="flex flex-col gap-2.5">
          {bags.map((bag, i) => (
            <div key={bag.id} className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pickup-tint font-display text-xl font-extrabold text-pickup">{i + 1}</span>
              <span className="flex-1 font-mono text-[22px] font-semibold tracking-[0.5px] max-[360px]:text-lg">{bag.bagNumber}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => window.print()} className={softButton}>
            <PrinterIcon size={22} />
            {t("स्टिकर छापें", "Print stickers")}
          </button>
          <button type="button" onClick={share} className={softButton}>
            <WhatsAppIcon size={22} />
            {t("WhatsApp भेजें", "Send on WhatsApp")}
          </button>
        </div>
      </ScreenBody>

      <ScreenFooter className="gap-2.5">
        <BigLink tone="count" href={`/count/${bags[0].id}`}>
          {t("अभी गिनती करें · Count now", "Count now · अभी गिनती करें")}
          <ArrowRightIcon />
        </BigLink>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/pickup" className="flex h-[52px] items-center justify-center rounded-2xl bg-elevated text-base font-bold hover:bg-raised">
            + {t("एक और पिकअप", "Another pickup")}
          </Link>
          <Link href="/" className="flex h-[52px] items-center justify-center rounded-2xl bg-elevated text-base font-bold hover:bg-raised">
            {t("घर जाएँ · Home", "Home · घर जाएँ")}
          </Link>
        </div>
      </ScreenFooter>

      <PrintSheet>
        {bags.map((bag, i) => (
          <PrintLabel key={bag.id} number={bag.bagNumber} lines={[`${company?.name} · ${party?.name}`, `${date} · ${i + 1}/${bags.length}`]} />
        ))}
      </PrintSheet>
    </Screen>
  );
}
