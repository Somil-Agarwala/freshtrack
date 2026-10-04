"use client";

import { useMemo, useState } from "react";
import { daysBetween, daysSince, inr, lakhShort, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { STALE_CLAIM_DAYS, isAwaitingPayment, shortfall } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Dispatch } from "@/types";
import { CompanyAvatar } from "@/components/ft/brand";
import { AgePill, BackButton, BigButton, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { useFlash } from "@/lib/device";

type Filter = "pending" | "paid" | "all";

/** Factory money: what was claimed, what came, what is still owed. */
export function MoneyScreen() {
  const { t, sub, lang } = useLang();
  const { dispatches, companies, recordSettlement } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [recording, setRecording] = useState<Dispatch | null>(null);
  const [message, flash] = useFlash();

  const claimed = dispatches.reduce((s, d) => s + d.claimedValue, 0);
  const received = dispatches.reduce((s, d) => s + (d.receivedValue ?? 0), 0);
  const pending = dispatches.filter(isAwaitingPayment);
  const pendingValue = pending.reduce((s, d) => s + d.claimedValue, 0);

  // Still owed first, oldest on top; then answered claims, newest first.
  const list = useMemo(() => {
    const owed = pending.slice().sort((a, b) => a.sentDate.localeCompare(b.sentDate));
    const paid = dispatches.filter((d) => !isAwaitingPayment(d)).sort((a, b) => (b.settledDate ?? "").localeCompare(a.settledDate ?? ""));
    return filter === "pending" ? owed : filter === "paid" ? paid : [...owed, ...paid];
  }, [dispatches, pending, filter]);

  const chip = (value: Filter, label: string) => (
    <button
      role="tab"
      aria-selected={filter === value}
      onClick={() => setFilter(value)}
      className={cn("h-11 shrink-0 rounded-full px-4 text-base", filter === value ? "bg-money font-bold text-money-ink" : "border border-line bg-surface font-semibold")}
    >
      {label}
    </button>
  );

  return (
    <Screen width="wide">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <BackButton href="/" label="Back to home" />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-extrabold leading-[1.1]">{t("हिसाब · Factory money", "Factory money · हिसाब")}</h1>
          <p className="text-[15px] text-ink-dim">{t("कितना क्लेम किया, कितना मिला", "What was claimed, what came in")}</p>
        </div>
      </header>

      <ScreenBody className="gap-3">
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          <Tile label={t("भेजा", "Sent")} value={lakhShort(claimed, 1)} foot={sub("भेजा", "Claimed")} />
          <Tile label={t("मिला", "Received")} value={lakhShort(received, 1)} foot={sub("मिला", "Received")} tone="money" />
          <Tile label={t("बाकी", "Pending")} value={lakhShort(pendingValue, 1)} foot={sub("बाकी", "Pending")} tone="factory" />
        </div>

        <div role="tablist" aria-label="Filter" className="no-scrollbar flex gap-2 overflow-x-auto">
          {chip("pending", `${t("बाकी", "Pending")} ${pending.length}`)}
          {chip("paid", t("मिल गया", "Paid"))}
          {chip("all", t("सब", "All"))}
        </div>

        <div className="grid gap-2.5 lg:grid-cols-2">
          {list.map((d) => {
            const company = companies.find((c) => c.id === d.companyId);
            const owed = isAwaitingPayment(d);
            const age = daysSince(d.sentDate);
            const cut = shortfall(d);
            const late = owed && age >= STALE_CLAIM_DAYS;
            const compact = owed && age === 0;
            return (
              <article
                key={d.id}
                className={cn(
                  "flex flex-col gap-2.5 rounded-[18px] border bg-surface p-3.5",
                  late ? "border-danger-line" : "border-line",
                  d.status === "settled" && "opacity-85"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <CompanyAvatar company={company} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-base font-semibold">{d.dispatchNumber}</span>
                    <span className="block truncate text-sm text-ink-dim">
                      {d.status === "settled" && d.settledDate
                        ? `${inr(d.claimedValue)} · ${t(`${daysBetween(d.sentDate, d.settledDate)} दिन में मिला`, `paid in ${daysBetween(d.sentDate, d.settledDate)} days`)}`
                        : `${d.bagCount} ${t("बैग", "bags")} · ${inr(d.claimedValue)}`}
                    </span>
                  </span>
                  {d.status === "settled" ? (
                    <span className="shrink-0 rounded-full bg-money-tint px-2.5 py-1 text-sm font-bold text-money">✓ {t("पूरा", "Paid")}</span>
                  ) : d.status === "rejected" ? (
                    <span className="shrink-0 rounded-full bg-danger-tint px-2.5 py-1 text-sm font-bold text-danger-soft">{t("मना किया", "Rejected")}</span>
                  ) : d.status === "partially_settled" ? (
                    <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-sm font-bold text-ink-dim">
                      {t(`${daysBetween(d.sentDate, d.settledDate ?? d.sentDate)} दिन`, `${daysBetween(d.sentDate, d.settledDate ?? d.sentDate)} days`)}
                    </span>
                  ) : compact ? (
                    <span className="shrink-0 rounded-full bg-factory-tint px-2.5 py-1 text-sm font-bold text-factory-soft">{t("आज भेजा", "Sent today")}</span>
                  ) : (
                    <AgePill days={age} warnAt={30} alarmAt={STALE_CLAIM_DAYS} />
                  )}
                </div>

                {d.status === "partially_settled" && (
                  <>
                    <div role="img" aria-label={`${d.receivedValue} of ${d.claimedValue} received`} className="flex h-3.5 overflow-hidden rounded-full bg-raised">
                      <span className="bg-money" style={{ width: `${Math.round(((d.receivedValue ?? 0) / d.claimedValue) * 100)}%` }} />
                    </div>
                    <p className="text-[15px] text-ink-dim">
                      <b className="text-money">
                        {inr(d.receivedValue ?? 0)} {t("मिला", "received")}
                      </b>{" "}
                      · {inr(cut)} {t("कम — फैक्ट्री ने कटौती की", "short — the factory deducted it")}
                    </p>
                  </>
                )}
                {d.status === "rejected" && <p className="text-[15px] font-bold text-danger-soft">{t("फैक्ट्री ने क्लेम नहीं माना", "The factory rejected this claim")}</p>}

                {owed && !compact && (
                  <>
                    <p className="text-[15px] font-bold text-count-soft">
                      {d.status === "under_review"
                        ? t("जाँच में · Under review", "Under review · जाँच में")
                        : t("फैक्ट्री को भेजा · Sent", "Sent · फैक्ट्री को भेजा")}
                      {late && ` — ${t("फैक्ट्री को फ़ोन करें", "call the factory")}`}
                    </p>
                    <button type="button" onClick={() => setRecording(d)} className="h-[52px] rounded-[14px] bg-money font-display text-lg font-extrabold text-money-ink hover:brightness-110">
                      {t("पैसा मिला? दर्ज करें", "Money came? Record it")}
                    </button>
                  </>
                )}
                {compact && (
                  <button type="button" onClick={() => setRecording(d)} className="self-start text-sm font-bold text-money">
                    {t("पैसा मिला? दर्ज करें", "Money came? Record it")}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        {list.length === 0 && <p className="rounded-[18px] bg-surface p-6 text-center text-ink-dim">{t("कुछ नहीं", "Nothing here")}</p>}
      </ScreenBody>

      <RecordPayment
        key={recording?.id ?? "none"}
        dispatch={recording}
        onClose={() => setRecording(null)}
        onSave={(value) => {
          if (!recording) return;
          recordSettlement(recording.id, value);
          setRecording(null);
          flash(lang === "hi" ? `${recording.dispatchNumber} · ${inr(value)} दर्ज हुआ` : `${recording.dispatchNumber} · ${inr(value)} recorded`);
        }}
      />
      <Notice message={message} />
    </Screen>
  );
}

function Tile({ label, value, foot, tone }: { label: string; value: string; foot: string; tone?: "money" | "factory" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        tone === "money" ? "border-money-line bg-money-tint" : tone === "factory" ? "border-factory-line bg-factory-panel" : "border-line bg-surface"
      )}
    >
      <p className={cn("text-sm", tone === "money" ? "text-money-mute" : tone === "factory" ? "text-factory-soft" : "text-ink-dim")}>{label}</p>
      <p className={cn("font-display text-2xl font-extrabold leading-[1.1] max-[380px]:text-xl", tone === "money" && "text-money", tone === "factory" && "text-factory")}>{value}</p>
      <p className={cn("text-xs", tone === "money" ? "text-money-mute" : tone === "factory" ? "text-factory-mute" : "text-ink-faint")}>{foot}</p>
    </div>
  );
}

function RecordPayment({ dispatch, onClose, onSave }: { dispatch: Dispatch | null; onClose: () => void; onSave: (value: number) => void }) {
  const { t } = useLang();
  const [amount, setAmount] = useState(dispatch ? String(dispatch.claimedValue) : "");
  const value = Number(amount) || 0;
  if (!dispatch) return null;
  const cut = Math.max(0, dispatch.claimedValue - value);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("कितना पैसा मिला?", "How much came in?")}
      description={`${dispatch.dispatchNumber} · ${t("क्लेम", "claim")} ${inr(dispatch.claimedValue)}`}
      footer={
        <BigButton tone="money" onClick={() => onSave(value)}>
          {t(`दर्ज करें · ${inr(value)}`, `Record · ${inr(value)}`)}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex h-16 items-center gap-2 rounded-2xl border-2 border-money bg-canvas px-4 font-display text-[32px] font-extrabold">
          ₹
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))}
            aria-label={t("मिली रकम", "Amount received")}
            className="min-w-0 flex-1 bg-transparent text-ink outline-none"
            autoFocus
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAmount(String(dispatch.claimedValue))} className="h-12 rounded-2xl bg-elevated text-[15px] font-bold">
            {t("पूरा मिला", "Paid in full")}
          </button>
          <button type="button" onClick={() => setAmount("0")} className="h-12 rounded-2xl bg-elevated text-[15px] font-bold text-danger-soft">
            {t("कुछ नहीं मिला", "Nothing paid")}
          </button>
        </div>
        <p className={cn("text-[15px]", cut > 0 ? "text-count-soft" : "text-money")}>
          {cut > 0 ? t(`${inr(cut)} कम मिला — कटौती दर्ज होगी`, `${inr(cut)} short — recorded as a deduction`) : t("पूरा क्लेम मिला ✓", "Full claim received ✓")}
          {cut > 0 && ` (${num(Math.round((value / dispatch.claimedValue) * 100))}%)`}
        </p>
      </div>
    </Dialog>
  );
}
