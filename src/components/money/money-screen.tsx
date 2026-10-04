"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { shareOnWhatsApp, useFlash } from "@/lib/device";
import { daysBetween, daysSince, fullDate, initials, inr, lakhShort, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { STALE_CLAIM_DAYS, dispatchShares, isAwaitingPayment, partyAccounts, shortfall, splitDispatch, type PartyAccount } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Dispatch, Distributor } from "@/types";
import { CompanyAvatar, partyTone } from "@/components/ft/brand";
import { ChevronRightIcon, WhatsAppIcon } from "@/components/ft/icons";
import { AgePill, BackButton, BigButton, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";

type Filter = "pending" | "paid" | "all";
type View = "runs" | "parties";

/**
 * Factory money, tracked per dispatch: what each run claimed and what the
 * factory paid for it. Each run's claim and payment are split across the
 * parties whose goods were on it, which gives every party its account.
 */
export function MoneyScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { t, sub, lang } = useLang();
  const { dispatches, distributors, sortedBags, collections, countLines, recordSettlement } = useStore();
  const view: View = params.get("view") === "parties" ? "parties" : "runs";
  const [filter, setFilter] = useState<Filter>("all");
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [openParty, setOpenParty] = useState<string | null>(null);
  const [recording, setRecording] = useState<Dispatch | null>(null);
  const [message, flash] = useFlash();

  const claimed = dispatches.reduce((s, d) => s + d.claimedValue, 0);
  const received = dispatches.reduce((s, d) => s + (d.receivedValue ?? 0), 0);
  const pending = dispatches.filter(isAwaitingPayment);
  const pendingValue = pending.reduce((s, d) => s + d.claimedValue, 0);
  const sharesOf = (d: Dispatch) => dispatchShares(d, sortedBags, collections, countLines);
  const accounts = useMemo(() => partyAccounts(dispatches, sortedBags, collections, countLines), [dispatches, sortedBags, collections, countLines]);
  const partyName = (id: string) => distributors.find((d) => d.id === id)?.name ?? "—";

  const setView = (next: View) => router.replace(next === "runs" ? pathname : `${pathname}?view=parties`, { scroll: false });

  const run = dispatches.find((d) => d.id === openRun) ?? null;
  const account = accounts.find((a) => a.distributorId === openParty) ?? null;

  const tab = (value: View, hi: string, en: string) => (
    <button
      role="tab"
      aria-selected={view === value}
      onClick={() => setView(value)}
      className={cn("flex h-[52px] flex-1 flex-col items-center justify-center rounded-[14px] leading-tight", view === value ? "bg-surface font-bold text-ink shadow" : "font-semibold text-ink-dim")}
    >
      <span className="text-base">{t(hi, en)}</span>
      <span className="text-xs font-medium text-ink-faint">{sub(hi, en)}</span>
    </button>
  );

  return (
    <Screen width="wide">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <BackButton href="/" label="Back to home" />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-extrabold leading-[1.1]">{t("हिसाब · Factory money", "Factory money · हिसाब")}</h1>
          <p className="text-[15px] text-ink-dim">{t("हर गाड़ी का क्लेम, और हर पार्टी का हिस्सा", "Every run's claim, and each party's share")}</p>
        </div>
      </header>

      <ScreenBody className="gap-3">
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          <Tile label={t("भेजा", "Sent")} value={lakhShort(claimed, 1)} foot={sub("भेजा", "Claimed")} />
          <Tile label={t("मिला", "Received")} value={lakhShort(received, 1)} foot={sub("मिला", "Received")} tone="money" />
          <Tile label={t("बाकी", "Pending")} value={lakhShort(pendingValue, 1)} foot={sub("बाकी", "Pending")} tone="factory" />
        </div>

        <div role="tablist" aria-label={t("कैसे देखें", "View")} className="flex gap-1 rounded-[18px] bg-elevated p-1">
          {tab("runs", "गाड़ी के हिसाब से", "By dispatch")}
          {tab("parties", "पार्टी के हिसाब से", "By party")}
        </div>

        {view === "runs" ? (
          <RunList dispatches={dispatches} filter={filter} onFilter={setFilter} sharesOf={sharesOf} partyName={partyName} onOpen={setOpenRun} onRecord={setRecording} />
        ) : (
          <PartyList accounts={accounts} distributors={distributors} onOpen={setOpenParty} />
        )}
      </ScreenBody>

      {run && (
        <RunSheet
          dispatch={run}
          shares={sharesOf(run)}
          partyName={partyName}
          onClose={() => setOpenRun(null)}
          onRecord={() => {
            setOpenRun(null);
            setRecording(run);
          }}
        />
      )}
      {account && <PartySheet account={account} party={distributors.find((d) => d.id === account.distributorId)} onClose={() => setOpenParty(null)} />}
      <RecordPayment
        key={recording?.id ?? "none"}
        dispatch={recording}
        shares={recording ? sharesOf(recording) : []}
        partyName={partyName}
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

/* ------------------------------------------------------------------ */
/* By dispatch                                                         */
/* ------------------------------------------------------------------ */

function RunList({
  dispatches,
  filter,
  onFilter,
  sharesOf,
  partyName,
  onOpen,
  onRecord,
}: {
  dispatches: Dispatch[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  sharesOf: (d: Dispatch) => ReturnType<typeof dispatchShares>;
  partyName: (id: string) => string;
  onOpen: (id: string) => void;
  onRecord: (d: Dispatch) => void;
}) {
  const { t } = useLang();
  const { companies } = useStore();
  const pending = dispatches.filter(isAwaitingPayment);

  // Still owed first, oldest on top; then answered claims, newest first.
  const owed = pending.slice().sort((a, b) => a.sentDate.localeCompare(b.sentDate));
  const paid = dispatches.filter((d) => !isAwaitingPayment(d)).sort((a, b) => (b.settledDate ?? "").localeCompare(a.settledDate ?? ""));
  const list = filter === "pending" ? owed : filter === "paid" ? paid : [...owed, ...paid];

  const chip = (value: Filter, label: string) => (
    <button
      role="tab"
      aria-selected={filter === value}
      onClick={() => onFilter(value)}
      className={cn("h-11 shrink-0 rounded-full px-4 text-base", filter === value ? "bg-money font-bold text-money-ink" : "border border-line bg-surface font-semibold")}
    >
      {label}
    </button>
  );

  return (
    <>
      <div role="tablist" aria-label="Filter" className="no-scrollbar flex gap-2 overflow-x-auto">
        {chip("pending", `${t("बाकी", "Pending")} ${pending.length}`)}
        {chip("paid", t("मिल गया", "Paid"))}
        {chip("all", t("सब", "All"))}
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        {list.map((d) => {
          const company = companies.find((c) => c.id === d.companyId);
          const owedRun = isAwaitingPayment(d);
          const age = daysSince(d.sentDate);
          const cut = shortfall(d);
          const late = owedRun && age >= STALE_CLAIM_DAYS;
          const compact = owedRun && age === 0;
          const parties = sharesOf(d).map((s) => partyName(s.distributorId));
          return (
            <article
              key={d.id}
              className={cn("flex flex-col gap-2.5 rounded-[18px] border bg-surface p-3.5", late ? "border-danger-line" : "border-line", d.status === "settled" && "opacity-85")}
            >
              <button type="button" onClick={() => onOpen(d.id)} className="flex flex-col gap-2.5 text-left" aria-label={`${d.dispatchNumber} — ${t("पार्टी के हिसाब से देखें", "see by party")}`}>
                <span className="flex w-full items-center gap-2.5">
                  <CompanyAvatar company={company} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-base font-semibold">{d.dispatchNumber}</span>
                    <span className="block truncate text-sm text-ink-dim">
                      {d.status === "settled" && d.settledDate
                        ? `${inr(d.claimedValue)} · ${t(`${daysBetween(d.sentDate, d.settledDate)} दिन में मिला`, `paid in ${daysBetween(d.sentDate, d.settledDate)} days`)}`
                        : `${d.bagCount} ${t("बैग", "bags")} · ${inr(d.claimedValue)}`}
                    </span>
                  </span>
                  <StatusPill d={d} />
                </span>
                {parties.length > 0 && (
                  <span className="flex w-full items-center gap-1.5 text-sm text-ink-dim">
                    <span className="min-w-0 flex-1 truncate">
                      {parties.length} {t("पार्टी", parties.length === 1 ? "party" : "parties")}: {parties.slice(0, 2).join(", ")}
                      {parties.length > 2 ? ` +${parties.length - 2}` : ""}
                    </span>
                    <ChevronRightIcon size={16} className="shrink-0 text-ink-faint" />
                  </span>
                )}
              </button>

              {d.status === "partially_settled" && (
                <>
                  <PaidBar paid={d.receivedValue ?? 0} of={d.claimedValue} />
                  <p className="text-[15px] text-ink-dim">
                    <b className="text-money">
                      {inr(d.receivedValue ?? 0)} {t("मिला", "received")}
                    </b>{" "}
                    · {inr(cut)} {t("कम — फैक्ट्री ने कटौती की", "short — the factory deducted it")}
                  </p>
                </>
              )}
              {d.status === "rejected" && <p className="text-[15px] font-bold text-danger-soft">{t("फैक्ट्री ने क्लेम नहीं माना", "The factory rejected this claim")}</p>}

              {owedRun && !compact && (
                <>
                  <p className="text-[15px] font-bold text-count-soft">
                    {d.status === "under_review" ? t("जाँच में · Under review", "Under review · जाँच में") : t("फैक्ट्री को भेजा · Sent", "Sent · फैक्ट्री को भेजा")}
                    {late && ` — ${t("फैक्ट्री को फ़ोन करें", "call the factory")}`}
                  </p>
                  <button type="button" onClick={() => onRecord(d)} className="h-[52px] rounded-[14px] bg-money font-display text-lg font-extrabold text-money-ink hover:brightness-110">
                    {t("पैसा मिला? दर्ज करें", "Money came? Record it")}
                  </button>
                </>
              )}
              {compact && (
                <button type="button" onClick={() => onRecord(d)} className="self-start text-sm font-bold text-money">
                  {t("पैसा मिला? दर्ज करें", "Money came? Record it")}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {list.length === 0 && <p className="rounded-[18px] bg-surface p-6 text-center text-ink-dim">{t("कुछ नहीं", "Nothing here")}</p>}
    </>
  );
}

function StatusPill({ d }: { d: Dispatch }) {
  const { t } = useLang();
  const age = daysSince(d.sentDate);
  if (d.status === "settled") return <span className="shrink-0 rounded-full bg-money-tint px-2.5 py-1 text-sm font-bold text-money">✓ {t("पूरा", "Paid")}</span>;
  if (d.status === "rejected") return <span className="shrink-0 rounded-full bg-danger-tint px-2.5 py-1 text-sm font-bold text-danger-soft">{t("मना किया", "Rejected")}</span>;
  if (d.status === "partially_settled") {
    const days = daysBetween(d.sentDate, d.settledDate ?? d.sentDate);
    return <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-sm font-bold text-ink-dim">{t(`${days} दिन`, `${days} days`)}</span>;
  }
  if (age === 0) return <span className="shrink-0 rounded-full bg-factory-tint px-2.5 py-1 text-sm font-bold text-factory-soft">{t("आज भेजा", "Sent today")}</span>;
  return <AgePill days={age} warnAt={30} alarmAt={STALE_CLAIM_DAYS} />;
}

function PaidBar({ paid, of, pending = 0 }: { paid: number; of: number; pending?: number }) {
  const pct = (v: number) => (of ? Math.min(100, (v / of) * 100) : 0);
  return (
    <div role="img" aria-label={`${paid} of ${of} received`} className="flex h-3.5 overflow-hidden rounded-full bg-raised">
      <span className="bg-money" style={{ width: `${pct(paid)}%` }} />
      {pending > 0 && <span className="bg-factory/70" style={{ width: `${pct(pending)}%` }} />}
    </div>
  );
}

/** One run, split by party: whose goods, their claim, their part of the payment. */
function RunSheet({
  dispatch,
  shares,
  partyName,
  onClose,
  onRecord,
}: {
  dispatch: Dispatch;
  shares: ReturnType<typeof dispatchShares>;
  partyName: (id: string) => string;
  onClose: () => void;
  onRecord: () => void;
}) {
  const { t, lang } = useLang();
  const { companies } = useStore();
  const company = companies.find((c) => c.id === dispatch.companyId);
  const owed = isAwaitingPayment(dispatch);
  const rows = splitDispatch(dispatch, shares);

  return (
    <Dialog
      open
      onClose={onClose}
      title={dispatch.dispatchNumber}
      description={`${company?.name} · ${fullDate(dispatch.sentDate, lang)} · ${dispatch.bagCount} ${t("बैग", "bags")} · ${num(dispatch.pieceCount)} ${t("पीस", "pcs")}`}
      footer={
        owed ? (
          <BigButton tone="money" onClick={onRecord}>
            {t("पैसा मिला? दर्ज करें", "Money came? Record it")}
          </BigButton>
        ) : (
          <BigButton tone="neutral" onClick={onClose}>
            {t("ठीक है", "Done")}
          </BigButton>
        )
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Tile label={t("क्लेम", "Claim")} value={lakhShort(dispatch.claimedValue, 1)} foot={inr(dispatch.claimedValue)} />
        <Tile label={t("मिला", "Received")} value={owed ? "—" : lakhShort(dispatch.receivedValue ?? 0, 1)} foot={owed ? t("अभी नहीं", "not yet") : inr(dispatch.receivedValue ?? 0)} tone="money" />
        <Tile
          label={owed ? t("बाकी", "Pending") : t("कटौती", "Deducted")}
          value={lakhShort(owed ? dispatch.claimedValue : shortfall(dispatch), 1)}
          foot={owed ? t("फैक्ट्री के पास", "with the factory") : inr(shortfall(dispatch))}
          tone="factory"
        />
      </div>

      <p className="mb-2 mt-4 text-[15px] font-bold">
        {t("किस पार्टी का कितना", "Each party's share")} <span className="font-medium text-ink-faint">· {t("Each party's share", "किस पार्टी का कितना")}</span>
      </p>
      {rows.length === 0 ? (
        <p className="text-ink-dim">{t("इस गाड़ी में पार्टी की जानकारी नहीं है", "No party details for this run")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.share.distributorId} className="rounded-2xl bg-elevated p-3">
              <div className="flex items-baseline justify-between gap-2">
                <b className="min-w-0 truncate text-base">{partyName(r.share.distributorId)}</b>
                <span className="shrink-0 text-sm text-ink-dim">{Math.round(r.ratio * 100)}%</span>
              </div>
              <div className="mt-0.5 flex flex-wrap justify-between gap-x-3 text-sm text-ink-dim">
                <span>
                  {num(r.share.pieces)} {t("पीस", "pcs")} · {t("क्लेम", "claim")} {inr(r.share.value)}
                </span>
                {owed ? (
                  <span className="font-bold text-factory-soft">{t("बाकी", "pending")}</span>
                ) : (
                  <span>
                    <b className="text-money">{inr(r.received)}</b>
                    {r.deducted > 0 && <span className="text-danger-soft"> · −{inr(r.deducted)}</span>}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!owed && shortfall(dispatch) > 0 && (
        <p className="mt-3 text-sm text-ink-faint">{t("फैक्ट्री की कटौती हर पार्टी पर उसके हिस्से के हिसाब से बँटी है।", "The factory's deduction is shared by each party in proportion to its claim.")}</p>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* By party                                                            */
/* ------------------------------------------------------------------ */

function PartyList({ accounts, distributors, onOpen }: { accounts: PartyAccount[]; distributors: Distributor[]; onOpen: (id: string) => void }) {
  const { t } = useLang();
  if (accounts.length === 0) return <p className="rounded-[18px] bg-surface p-6 text-center text-ink-dim">{t("अभी कोई गाड़ी नहीं गई", "No runs sent yet")}</p>;
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {accounts.map((a) => {
        const party = distributors.find((d) => d.id === a.distributorId);
        const name = party?.name ?? "—";
        const tone = partyTone(name);
        return (
          <button
            key={a.distributorId}
            type="button"
            onClick={() => onOpen(a.distributorId)}
            className={cn("flex flex-col gap-2.5 rounded-[18px] border bg-surface p-3.5 text-left transition-colors hover:bg-elevated", a.pending > 0 ? "border-factory-line" : "border-line")}
          >
            <span className="flex w-full items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-display text-lg font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-bold leading-[1.2]">{name}</span>
                <span className="block truncate text-sm text-ink-dim">
                  {party?.region ? `${party.region} · ` : ""}
                  {a.runs.length} {t("गाड़ी", a.runs.length === 1 ? "run" : "runs")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {a.pending > 0 ? (
                  <>
                    <span className="block font-display text-[22px] font-extrabold leading-none text-factory">{lakhShort(a.pending, 1)}</span>
                    <span className="text-[13px] text-factory-mute">{t("बाकी", "pending")}</span>
                  </>
                ) : (
                  <span className="rounded-full bg-money-tint px-2.5 py-1 text-sm font-bold text-money">✓ {t("सब मिला", "All in")}</span>
                )}
              </span>
            </span>
            <PaidBar paid={a.received} of={a.claimed} pending={a.pending} />
            <span className="grid w-full grid-cols-3 gap-2 text-sm">
              <Mini label={t("भेजा", "Claimed")} value={lakhShort(a.claimed, 1)} />
              <Mini label={t("मिला", "Received")} value={lakhShort(a.received, 1)} tone="text-money" />
              <Mini label={t("कटौती", "Deducted")} value={a.deducted ? lakhShort(a.deducted, 1) : "—"} tone={a.deducted ? "text-danger-soft" : undefined} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span>
      <span className="block text-ink-faint">{label}</span>
      <b className={cn("text-base", tone)}>{value}</b>
    </span>
  );
}

/** A party's account: every run its goods went on, with its share of each. */
function PartySheet({ account, party, onClose }: { account: PartyAccount; party?: Distributor; onClose: () => void }) {
  const { t, lang } = useLang();
  const { companies } = useStore();
  const name = party?.name ?? "—";

  function share() {
    const lines = [
      `${name} · ${t("डैमेज क्लेम का हिसाब", "damage claim statement")}`,
      ...account.runs.map((r) => {
        const d = r.dispatch;
        const status = isAwaitingPayment(d) ? t("बाकी", "pending") : `${t("मिला", "received")} ${inr(r.received)}${r.deducted ? ` (${t("कटौती", "deducted")} ${inr(r.deducted)})` : ""}`;
        return `${d.dispatchNumber} · ${fullDate(d.sentDate, lang)} · ${num(r.share.pieces)} ${t("पीस", "pcs")} · ${t("क्लेम", "claim")} ${inr(r.share.value)} · ${status}`;
      }),
      `${t("कुल क्लेम", "Total claimed")}: ${inr(account.claimed)} · ${t("मिला", "Received")}: ${inr(account.received)} · ${t("बाकी", "Pending")}: ${inr(account.pending)}`,
    ];
    shareOnWhatsApp(lines.join("\n"));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={name}
      description={`${party?.region ? `${party.region} · ` : ""}${party?.contactName ?? ""}`}
      footer={
        <BigButton tone="money" onClick={share}>
          <WhatsAppIcon />
          {t("हिसाब WhatsApp करें", "Send statement on WhatsApp")}
        </BigButton>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Tile label={t("भेजा", "Claimed")} value={lakhShort(account.claimed, 1)} foot={inr(account.claimed)} />
        <Tile label={t("मिला", "Received")} value={lakhShort(account.received, 1)} foot={account.recovery === null ? "—" : `${account.recovery}% ${t("रिकवरी", "recovery")}`} tone="money" />
        <Tile label={t("बाकी", "Pending")} value={lakhShort(account.pending, 1)} foot={account.deducted ? `${t("कटौती", "cut")} ${inr(account.deducted)}` : inr(account.pending)} tone="factory" />
      </div>

      <p className="mb-2 mt-4 text-[15px] font-bold">
        {t("गाड़ी के हिसाब से", "By dispatch")} <span className="font-medium text-ink-faint">· {account.runs.length}</span>
      </p>
      <div className="flex flex-col gap-2">
        {account.runs.map((r) => {
          const d = r.dispatch;
          const company = companies.find((c) => c.id === d.companyId);
          const owed = isAwaitingPayment(d);
          return (
            <div key={d.id} className="flex items-center gap-2.5 rounded-2xl bg-elevated p-3">
              <CompanyAvatar company={company} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[15px] font-semibold">{d.dispatchNumber}</span>
                <span className="block truncate text-[13px] text-ink-dim">
                  {fullDate(d.sentDate, lang)} · {num(r.share.pieces)} {t("पीस", "pcs")} · {inr(r.share.value)}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                {owed ? (
                  <span className="font-bold text-factory-soft">{t("बाकी", "Pending")}</span>
                ) : (
                  <>
                    <b className="block text-money">{inr(r.received)}</b>
                    {r.deducted > 0 && <span className="text-danger-soft">−{inr(r.deducted)}</span>}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function Tile({ label, value, foot, tone }: { label: string; value: string; foot: string; tone?: "money" | "factory" }) {
  return (
    <div className={cn("rounded-2xl border p-3", tone === "money" ? "border-money-line bg-money-tint" : tone === "factory" ? "border-factory-line bg-factory-panel" : "border-line bg-surface")}>
      <p className={cn("text-sm", tone === "money" ? "text-money-mute" : tone === "factory" ? "text-factory-soft" : "text-ink-dim")}>{label}</p>
      <p className={cn("font-display text-2xl font-extrabold leading-[1.1] max-[380px]:text-xl", tone === "money" && "text-money", tone === "factory" && "text-factory")}>{value}</p>
      <p className={cn("truncate text-xs", tone === "money" ? "text-money-mute" : tone === "factory" ? "text-factory-mute" : "text-ink-faint")}>{foot}</p>
    </div>
  );
}

function RecordPayment({
  dispatch,
  shares,
  partyName,
  onClose,
  onSave,
}: {
  dispatch: Dispatch | null;
  shares: ReturnType<typeof dispatchShares>;
  partyName: (id: string) => string;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const { t } = useLang();
  const [amount, setAmount] = useState(dispatch ? String(dispatch.claimedValue) : "");
  const value = Number(amount) || 0;
  if (!dispatch) return null;
  const cut = Math.max(0, dispatch.claimedValue - value);
  // Preview how this payment lands on each party, as it will be recorded.
  const split = splitDispatch({ ...dispatch, receivedValue: value, status: value < dispatch.claimedValue ? "partially_settled" : "settled" }, shares);

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
        {split.length > 1 && (
          <div className="rounded-2xl bg-elevated p-3">
            <p className="mb-1.5 text-sm font-bold text-ink-dim">{t("पार्टियों में ऐसे बँटेगा", "How it splits across parties")}</p>
            {split.map((r) => (
              <div key={r.share.distributorId} className="flex justify-between gap-2 py-0.5 text-[15px]">
                <span className="min-w-0 truncate">{partyName(r.share.distributorId)}</span>
                <b className="shrink-0 text-money">{inr(r.received)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
