"use client";

import Link from "next/link";
import { useState } from "react";
import { DISPATCH_STATUS_HI, DISPATCH_STATUS_LABELS } from "@/lib/constants";
import { shareOnWhatsApp, useFlash } from "@/lib/device";
import { exportDispatch } from "@/lib/export";
import { daysBetween, daysSince, fullDate, inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { dispatchShares, isAwaitingPayment, shortfall, splitDispatch } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { MrpCircle } from "@/components/ft/brand";
import { PrinterIcon, TruckIcon, WhatsAppIcon } from "@/components/ft/icons";
import { EmptyCard, ExportButton, Pill, StatTile } from "@/components/ft/kit";
import { PrintSheet } from "@/components/ft/print-sheet";
import { BigButton, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";
import { Notice } from "@/components/ui/notice";
import { Slip, slipRows } from "@/components/send/send-done";
import { RecordPayment } from "./money-screen";

/** One factory run: the slip, whose goods were on it, and its payment. */
export function RunDetail({ dispatchId }: { dispatchId: string }) {
  const { t, lang } = useLang();
  const { dispatches, companies, sortedBags, collections, countLines, distributors, recordSettlement } = useStore();
  const [recording, setRecording] = useState(false);
  const { can } = useSession();
  const [message, flash] = useFlash();
  const d = dispatches.find((x) => x.id === dispatchId);
  const company = companies.find((c) => c.id === d?.companyId);

  if (!d || !company) {
    return (
      <Screen>
        <TaskHeader back="/money" tone="money" kicker={t("हिसाब", "Money")} />
        <ScreenBody>
          <EmptyCard title={t("यह गाड़ी नहीं मिली", "Run not found")} />
        </ScreenBody>
      </Screen>
    );
  }

  const bags = sortedBags.filter((b) => b.dispatchId === d.id).sort((a, b) => a.bagNumber.localeCompare(b.bagNumber));
  const shares = dispatchShares(d, sortedBags, collections, countLines);
  const split = splitDispatch(d, shares);
  const owed = isAwaitingPayment(d);
  const partyName = (id: string) => distributors.find((x) => x.id === id)?.name ?? "—";

  function share() {
    shareOnWhatsApp(
      [
        `${d!.dispatchNumber} · ${company!.name} · ${fullDate(d!.sentDate, lang)}`,
        `${d!.bagCount} ${t("बैग", "bags")} · ${num(d!.pieceCount)} ${t("पीस", "pcs")} · ${t("क्लेम", "claim")} ${inr(d!.claimedValue)}`,
        owed ? t("पैसा बाकी", "Payment pending") : `${t("मिला", "Received")} ${inr(d!.receivedValue ?? 0)}`,
      ].join("\n")
    );
  }

  return (
    <Screen>
      <TaskHeader
        back="/money"
        tone="factory"
        kicker={`${company.name} · ${t(DISPATCH_STATUS_HI[d.status], DISPATCH_STATUS_LABELS[d.status])}`}
        aside={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-factory text-factory-ink">
            <TruckIcon size={26} />
          </span>
        }
      >
        <p className="truncate font-mono text-[19px] font-semibold">{d.dispatchNumber}</p>
      </TaskHeader>

      <ScreenBody className="gap-3">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label={t("क्लेम", "Claim")} value={inr(d.claimedValue)} foot={fullDate(d.sentDate, lang)} />
          <StatTile label={t("मिला", "Received")} value={owed ? "—" : inr(d.receivedValue ?? 0)} foot={d.settledDate ? t(`${daysBetween(d.sentDate, d.settledDate)} दिन में`, `in ${daysBetween(d.sentDate, d.settledDate)} days`) : t(`${daysSince(d.sentDate)} दिन से`, `${daysSince(d.sentDate)} days`)} tone="money" />
          <StatTile label={owed ? t("बाकी", "Pending") : t("कटौती", "Deducted")} value={inr(owed ? d.claimedValue : shortfall(d))} tone="factory" />
        </div>

        <Slip dispatch={d} company={company} rows={slipRows(bags)} />

        <section className="rounded-[20px] border border-line bg-surface px-3.5 py-3">
          <p className="mb-1 text-[15px] font-bold">
            {t("किस पार्टी का कितना", "Each party's share")} <span className="font-medium text-ink-faint">· {split.length}</span>
          </p>
          {split.length === 0 && <p className="text-ink-dim">{t("पार्टी की जानकारी नहीं है", "No party details")}</p>}
          <div className="flex flex-col divide-y divide-line">
            {split.map((r) => (
              <div key={r.share.distributorId} className="flex items-center justify-between gap-2 py-2.5 text-[15px]">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{partyName(r.share.distributorId)}</span>
                  <span className="text-[13px] text-ink-dim">
                    {num(r.share.pieces)} {t("पीस", "pcs")} · {inr(r.share.value)} · {Math.round(r.ratio * 100)}%
                  </span>
                </span>
                {owed ? (
                  <Pill tone="factory">{t("बाकी", "Pending")}</Pill>
                ) : (
                  <span className="shrink-0 text-right">
                    <b className="block text-money">{inr(r.received)}</b>
                    {r.deducted > 0 && <span className="text-[13px] text-danger-soft">−{inr(r.deducted)}</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {bags.length > 0 && (
          <section className="rounded-[20px] border border-line bg-surface px-3.5 py-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[15px] font-bold">
                {t("बैग", "Bags")} <span className="font-medium text-ink-faint">· {bags.length}</span>
              </p>
              <ExportButton onClick={() => exportDispatch({ dispatch: d, bags, collections, distributors, companies })} />
            </div>
            <div className="flex flex-col divide-y divide-line">
              {bags.map((b) => (
                <Link key={b.id} href={`/sorted-bags?q=${b.bagNumber}`} className="flex items-center gap-2.5 py-2">
                  <MrpCircle mrp={b.mrp} size={32} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold">{b.bagNumber}</span>
                  <span className="text-sm text-ink-dim">
                    {num(b.pieceCount)} {t("पीस", "pcs")}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={share} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-elevated font-bold">
            <WhatsAppIcon size={22} />
            WhatsApp
          </button>
          <button type="button" onClick={() => window.print()} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-elevated font-bold">
            <PrinterIcon size={22} />
            {t("चालान छापें", "Print slip")}
          </button>
        </div>
      </ScreenBody>

      {owed && can("recordPayment") && (
        <ScreenFooter>
          <BigButton tone="money" onClick={() => setRecording(true)}>
            {t("पैसा मिला? दर्ज करें", "Money came? Record it")}
          </BigButton>
        </ScreenFooter>
      )}

      <RecordPayment
        key={recording ? "open" : "closed"}
        dispatch={recording ? d : null}
        shares={shares}
        partyName={partyName}
        onClose={() => setRecording(false)}
        onSave={(value) => {
          recordSettlement(d.id, value);
          setRecording(false);
          flash(t(`${inr(value)} दर्ज हुआ`, `${inr(value)} recorded`));
        }}
      />
      <Notice message={message} />
      <PrintSheet>
        <Slip dispatch={d} company={company} rows={slipRows(bags)} />
      </PrintSheet>
    </Screen>
  );
}
