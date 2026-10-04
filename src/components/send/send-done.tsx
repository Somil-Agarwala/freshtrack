"use client";

import Link from "next/link";
import { shareOnWhatsApp } from "@/lib/device";
import { fullDate, inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Company, Dispatch, SortedBag } from "@/types";
import { CompanyAvatar } from "@/components/ft/brand";
import { ChevronRightIcon, FileIcon, PrinterIcon, RupeeIcon, TruckIcon, WhatsAppIcon } from "@/components/ft/icons";
import { PrintSheet } from "@/components/ft/print-sheet";
import { BigLink, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";

/** The run has left: the slip to send the factory with the bags. */
export function SendDone({ dispatchId }: { dispatchId: string }) {
  const { t, lang } = useLang();
  const { dispatches, companies, sortedBags } = useStore();
  const dispatch = dispatches.find((d) => d.id === dispatchId);
  const company = companies.find((c) => c.id === dispatch?.companyId);

  if (!dispatch || !company) {
    return (
      <Screen>
        <ScreenBody className="items-center justify-center">
          <Link href="/money" className="font-bold text-money">
            {t("हिसाब देखें", "Open money")}
          </Link>
        </ScreenBody>
      </Screen>
    );
  }

  const bags = sortedBags.filter((b) => b.dispatchId === dispatch.id);
  const rows = slipRows(bags);

  function share() {
    const lines = [
      `${dispatch!.dispatchNumber} · ${company!.name}`,
      fullDate(dispatch!.sentDate, lang),
      ...rows.map((r) => `₹${r.mrp}: ${r.bags} ${t("बैग", "bags")} · ${num(r.pieces)} ${t("पीस", "pcs")} · ${inr(r.value)}`),
      `${t("कुल", "Total")}: ${dispatch!.bagCount} ${t("बैग", "bags")} · ${num(dispatch!.pieceCount)} ${t("पीस", "pcs")} · ${inr(dispatch!.claimedValue)}`,
    ];
    shareOnWhatsApp(lines.join("\n"));
  }

  const action = "flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-elevated text-[15px] font-bold hover:bg-raised";

  return (
    <Screen>
      <ScreenBody className="pt-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-factory text-factory-ink">
            <TruckIcon size={34} />
          </span>
          <div>
            <h1 className="font-display text-[28px] font-extrabold leading-[1.1]">{t("गाड़ी रवाना!", "Run sent!")}</h1>
            <p className="text-base text-ink-dim">{t(`Dispatch created for ${company.name}`, `${company.name} के लिए चालान बना`)}</p>
          </div>
        </div>

        <Slip dispatch={dispatch} company={company} rows={rows} />

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={share} className={action}>
            <WhatsAppIcon />
            WhatsApp
          </button>
          {/* The browser's print dialog offers "Save as PDF". */}
          <button type="button" onClick={() => window.print()} className={action}>
            <FileIcon />
            PDF
          </button>
          <button type="button" onClick={() => window.print()} className={action}>
            <PrinterIcon />
            {t("प्रिंट", "Print")}
          </button>
        </div>

        <Link href="/money" className="flex items-center gap-3 rounded-2xl bg-money-tint p-3.5 text-[15px] leading-[1.35] text-money-note">
          <RupeeIcon className="shrink-0 text-money" />
          <span className="flex-1">
            {lang === "hi" ? (
              <>
                फैक्ट्री से पैसा आने पर <b>हिसाब</b> में दर्ज करें।
                <br />
                <span className="text-sm text-money-mute">Record the payment in Money when it arrives.</span>
              </>
            ) : (
              <>
                Record the payment in <b>Money</b> when it arrives.
                <br />
                <span className="text-sm text-money-mute">फैक्ट्री से पैसा आने पर हिसाब में दर्ज करें।</span>
              </>
            )}
          </span>
          <ChevronRightIcon size={20} />
        </Link>
      </ScreenBody>

      <ScreenFooter>
        <BigLink tone="neutral" href="/" className="h-[60px]">
          {t("घर जाएँ · Home", "Home · घर जाएँ")}
        </BigLink>
      </ScreenFooter>

      <PrintSheet>
        <Slip dispatch={dispatch} company={company} rows={rows} />
      </PrintSheet>
    </Screen>
  );
}

type SlipRow = { mrp: number; bags: number; pieces: number; value: number };

function slipRows(bags: SortedBag[]): SlipRow[] {
  const byMrp = new Map<number, SlipRow>();
  bags.forEach((b) => {
    const row = byMrp.get(b.mrp) ?? { mrp: b.mrp, bags: 0, pieces: 0, value: 0 };
    row.bags += 1;
    row.pieces += b.pieceCount;
    row.value += b.pieceCount * b.mrp;
    byMrp.set(b.mrp, row);
  });
  return Array.from(byMrp.values()).sort((a, b) => b.value - a.value);
}

function Slip({ dispatch, company, rows }: { dispatch: Dispatch; company: Company; rows: SlipRow[] }) {
  const { lang } = useLang();
  return (
    <section className="flex flex-col gap-2.5 rounded-[20px] bg-white p-4 text-[#111418]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] text-[#4A5260]">चालान नंबर · Dispatch no.</p>
          <p className="font-mono text-[22px] font-semibold max-[380px]:text-lg">{dispatch.dispatchNumber}</p>
        </div>
        <CompanyAvatar company={company} size={40} />
      </div>
      <p className="text-[15px] text-[#2E3440]">
        {fullDate(dispatch.sentDate, lang)}
        {company.claimContact ? ` · ${company.claimContact}` : ""}
      </p>
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="text-left text-[13px] text-[#4A5260]">
            <th className="py-1.5 font-semibold">MRP</th>
            <th className="py-1.5 text-right font-semibold">बैग</th>
            <th className="py-1.5 text-right font-semibold">पीस</th>
            <th className="py-1.5 text-right font-semibold">₹</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mrp} className="border-t border-[#E3E6EB]">
              <td className="py-[7px] font-bold">₹{r.mrp}</td>
              <td className="text-right">{r.bags}</td>
              <td className="text-right">{num(r.pieces)}</td>
              <td className="text-right">{num(r.value)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[#111418] font-extrabold">
            <td className="py-2">कुल</td>
            <td className="text-right">{dispatch.bagCount}</td>
            <td className="text-right">{num(dispatch.pieceCount)}</td>
            <td className="text-right">{num(dispatch.claimedValue)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
