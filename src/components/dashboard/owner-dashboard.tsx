"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { lakh, lakhShort, longDate, num, shortDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn, today } from "@/lib/utils";
import { CompanyAvatar, MrpCircle } from "@/components/ft/brand";
import { ChevronRightIcon } from "@/components/ft/icons";
import { useDashboardFilters } from "@/components/layout/dashboard-filters";
import { useDashboard, type Alert } from "./use-dashboard";

type Data = ReturnType<typeof useDashboard>;

const STAGE: Record<string, { bar: string; swatch: string; text: string; border: string }> = {
  count: { bar: "bg-count", swatch: "bg-count", text: "text-count-soft", border: "border-t-count" },
  pile: { bar: "bg-pile", swatch: "bg-pile", text: "text-pile-soft", border: "border-t-pile" },
  factory: { bar: "bg-factory", swatch: "bg-factory", text: "text-factory-soft", border: "border-t-factory" },
  pickup: { bar: "bg-pickup", swatch: "bg-pickup", text: "text-pickup-soft", border: "border-t-pickup" },
};

const recoveryTone = (r: number | null) => (r === null ? "text-ink-faint" : r >= 90 ? "text-money" : r >= 80 ? "text-count-soft" : "text-danger-soft");

/** The owner's view: where the damage money is stuck and what to chase. */
export function OwnerDashboard({ phone = true, desktop = true }: { phone?: boolean; desktop?: boolean }) {
  const { lang } = useLang();
  const { companyId, period } = useDashboardFilters();
  const data = useDashboard(companyId, period, lang);
  return (
    <>
      {phone && (
        <div className="lg:hidden">
          <PhoneDashboard data={data} />
        </div>
      )}
      {desktop && (
        <div className="max-lg:hidden">
          <DesktopDashboard data={data} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function StageBar({ data, height }: { data: Data; height: number }) {
  const total = data.stuck || 1;
  return (
    <div role="img" aria-label="Share of stuck money by stage" className="flex overflow-hidden rounded-full bg-raised" style={{ height }}>
      {data.stages.map((s) => (
        <span key={s.key} className={STAGE[s.key].bar} style={{ width: `${(s.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

function AlertRow({ alert, desktop }: { alert: Alert; desktop?: boolean }) {
  const { t } = useLang();
  const red = alert.level === "red";
  return (
    <Link href={alert.href} className={cn("flex items-center gap-2.5 rounded-[14px] p-3 transition-colors", red ? "border border-danger-line bg-danger-card hover:bg-danger-tint" : "bg-elevated hover:bg-raised", desktop && "gap-3")}>
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", red ? "bg-danger" : alert.level === "yellow" ? "bg-count" : "bg-pickup")} />
      <span className="flex-1 text-[15px] leading-[1.3]">
        <b>{alert.title}</b>
        {desktop && (
          <>
            <br />
            <span className="text-ink-dim">{alert.detail}</span>
          </>
        )}
      </span>
      {desktop ? (
        <span className={cn("whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm font-bold", red ? "bg-danger-tint text-[#FFB3B3]" : "bg-raised")}>{t("देखें", "View")}</span>
      ) : (
        <ChevronRightIcon size={18} className="text-ink-faint" />
      )}
    </Link>
  );
}

function WeeklyBars({ data, height, labels }: { data: Data; height: number; labels: "ends" | "all" }) {
  const { lang } = useLang();
  const max = Math.max(1, ...data.weeks.flatMap((w) => [w.came, w.counted]));
  return (
    <>
      <div role="img" aria-label="Last 8 weeks: bags collected versus bags counted" className="mt-3 flex items-end gap-1.5 border-b border-line lg:mt-4 lg:gap-2.5" style={{ height }}>
        {data.weeks.map((w) => (
          <div key={w.label} className="flex flex-1 items-end justify-center gap-0.5 lg:gap-[3px]" title={`${w.came} / ${w.counted}`}>
            <span className="flex-1 rounded-t-[3px] bg-pickup lg:max-w-[40%] lg:rounded-t-[4px]" style={{ height: (w.came / max) * height }} />
            <span className="flex-1 rounded-t-[3px] bg-count lg:max-w-[40%] lg:rounded-t-[4px]" style={{ height: (w.counted / max) * height }} />
          </div>
        ))}
      </div>
      {labels === "ends" ? (
        <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
          <span>{shortDate(data.weeks[0].label, lang)}</span>
          <span>{shortDate(data.weeks[data.weeks.length - 1].label, lang)}</span>
        </div>
      ) : (
        <div className="mt-1.5 flex gap-2.5 text-center text-[13px] text-ink-faint">
          {data.weeks.map((w) => (
            <span key={w.label} className="flex-1">
              {shortDate(w.label, lang)}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function Legend() {
  const { t } = useLang();
  return (
    <span className="flex gap-3.5 text-sm text-ink-dim">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] bg-pickup" />
        {t("आए", "In")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] bg-count" />
        {t("गिने", "Counted")}
      </span>
    </span>
  );
}

function BehindNote({ data }: { data: Data }) {
  const { t } = useLang();
  if (data.behind < 2) return null;
  return (
    <p className="mt-2.5 rounded-xl bg-count-tint px-3 py-2.5 text-[15px] text-count-note lg:mt-3.5">
      {t(`पिछले ${data.behind} हफ़्ते गिनती पिकअप से पीछे — ${data.uncountedNow} बैग जमा हो गए।`, `Counting has trailed pickups for ${data.behind} weeks — ${data.uncountedNow} bags piled up.`)}{" "}
      <span className="text-count-mute">{t("Counting is falling behind pickups.", "गिनती पिकअप से पीछे है।")}</span>
    </p>
  );
}

function PartyBars({ data }: { data: Data }) {
  const { t } = useLang();
  const max = data.parties[0]?.value || 1;
  if (!data.parties.length) return <p className="text-ink-dim">{t("अभी कोई गिनती नहीं", "Nothing counted yet")}</p>;
  return (
    <div className="flex flex-col gap-2.5 text-[15px] lg:gap-3">
      {data.parties.map((p) => (
        <div key={p.name}>
          <div className="flex justify-between gap-2">
            <span className="truncate">{p.name}</span>
            <b>{lakhShort(p.value, 1)}</b>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-raised">
            <div className="h-2.5 rounded-full bg-pickup" style={{ width: `${(p.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const card = "rounded-[20px] border border-line bg-surface";

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

function PhoneDashboard({ data }: { data: Data }) {
  const { t, lang } = useLang();
  const { companies } = useStore();
  const { companyId, setCompanyId, period } = useDashboardFilters();

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-3.5 px-4 pb-6 pt-[18px]">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-extrabold leading-[1.1]">{t("डैशबोर्ड", "Dashboard")}</h1>
          <p className="text-sm text-ink-dim">
            {longDate(today(), lang)} · {period === "month" ? t("इस महीने", "this month") : t("पिछले 90 दिन", "last 90 days")}
          </p>
        </div>
        <label className="relative">
          <span className="sr-only">{t("कंपनी", "Company")}</span>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="h-11 appearance-none rounded-full border border-line bg-surface pl-3.5 pr-8 text-[15px] font-bold text-ink"
          >
            <option value="all">{t("सभी कंपनी", "All companies")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm">▾</span>
        </label>
      </header>

      <section aria-label="Money by stage" className={cn(card, "p-4")}>
        <p className="text-[15px] text-ink-dim">
          {t("पैसा कहाँ अटका है?", "Where is the money stuck?")} · {t("Total stuck", "कुल अटका")}
        </p>
        <p className="font-display text-[40px] font-extrabold leading-[1.1]">{lakh(data.stuck, lang)}</p>
        <div className="mt-2.5">
          <StageBar data={data} height={20} />
        </div>
        <div className="mt-3 flex flex-col">
          {data.stages.map((s, i) => (
            <Link key={s.key} href={s.href} className={cn("flex min-h-12 items-center gap-2.5 text-base", i > 0 && "border-t border-line")}>
              <span className={cn("h-3.5 w-3.5 shrink-0 rounded", STAGE[s.key].swatch)} />
              <span className="flex-1">
                {t(s.hi, s.en)} <span className="text-ink-faint">· {s.count}</span>
              </span>
              <b>
                {s.estimate ? "~" : ""}
                {lakhShort(s.value, 1)}
              </b>
            </Link>
          ))}
        </div>
        <p className="mt-2 rounded-xl bg-money-tint px-3 py-2.5 text-[15px] text-money-note">
          ✓ {period === "month" ? t("इस महीने मिला", "Received this month") : t("90 दिन में मिला", "Received in 90 days")}{" "}
          <b className="text-lg text-money">{lakh(data.receivedInPeriod, lang)}</b>
        </p>
      </section>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-2.5">
        <KeyTile label={t("रिकवरी", "Recovery")} value={data.recovery === null ? "—" : `${data.recovery}%`} valueClass={recoveryTone(data.recovery)} foot={t("90 दिन · Recovery", "90 days")} />
        <KeyTile
          label={t("पैसा आने में", "Days to get paid")}
          value={data.daysToPay === null ? "—" : `${data.daysToPay} ${t("दिन", "d")}`}
          foot={<DaysChange data={data} />}
        />
        <KeyTile label={t("फैक्ट्री की कटौती", "Factory deductions")} value={lakhShort(data.deductions)} valueClass="text-danger-icon" foot={t(`इस तिमाही · ${data.deductionRuns} गाड़ी`, `this quarter · ${data.deductionRuns} runs`)} />
        <KeyTile label={t("बैग आए", "Bags in")} value={num(data.bagsIn)} foot={<BagsChange data={data} />} />
      </section>

      {data.alerts.length > 0 && (
        <section aria-label="Needs attention" className="flex flex-col gap-2">
          <h2 className="mx-0.5 mt-1 font-display text-[21px] font-extrabold">
            {t("ध्यान दें", "Needs attention")} <span className="font-sans text-sm font-medium text-ink-faint">· {data.alerts.length}</span>
          </h2>
          {data.alerts.slice(0, 6).map((a) => (
            <AlertRow key={a.title} alert={a} />
          ))}
        </section>
      )}

      <section aria-label="By company" className="flex flex-col gap-2">
        <h2 className="mx-0.5 mt-1 font-display text-[21px] font-extrabold">{t("कंपनी के हिसाब से", "By company")}</h2>
        {data.companyRows.map((r) => (
          <div key={r.company.id} className={cn("flex items-center gap-2.5 rounded-2xl border bg-surface p-3", r.lateClaim ? "border-danger-line" : "border-line")}>
            <CompanyAvatar company={r.company} size={40} />
            <span className="min-w-0 flex-1">
              <b className="block text-base">{r.company.name}</b>
              <span className="text-sm text-ink-dim">
                {r.ready || r.uncounted
                  ? [r.ready ? t(`${r.ready} बैग तैयार`, `${r.ready} bags ready`) : null, r.uncounted ? t(`${r.uncounted} गिनती बाकी`, `${r.uncounted} to count`) : null].filter(Boolean).join(" · ")
                  : t("कुछ बाकी नहीं", "Nothing pending")}
              </span>
            </span>
            <span className="text-right">
              <b className="block text-base text-pickup-soft">{lakhShort(r.owedValue)}</b>
              <span className={cn("text-[13px]", recoveryTone(r.recovery))}>{r.recovery === null ? "—" : `${r.recovery}%`}</span>
            </span>
          </div>
        ))}
        <p className="mx-0.5 text-[13px] text-ink-faint">{t("नीली रकम = फैक्ट्री के पास बाकी · % = रिकवरी", "Blue = still with the factory · % = recovery")}</p>
      </section>

      <section aria-label="Weekly flow" className={cn(card, "p-4")}>
        <h2 className="font-display text-xl font-extrabold">{t("हर हफ़्ते · आए vs गिने", "Every week · in vs counted")}</h2>
        <WeeklyBars data={data} height={130} labels="ends" />
        <div className="mt-2">
          <Legend />
        </div>
        <BehindNote data={data} />
      </section>

      <section aria-label="Damage by party" className={cn(card, "p-4")}>
        <h2 className="mb-3 font-display text-xl font-extrabold">{t("किस पार्टी से ज़्यादा डैमेज", "Most damage by party")}</h2>
        <PartyBars data={data} />
      </section>

      <Link href="/analytics" className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-elevated text-base font-bold">
        {t("विस्तृत रिपोर्ट देखें", "Open detailed reports")}
        <ChevronRightIcon size={18} />
      </Link>
    </div>
  );
}

function KeyTile({ label, value, foot, valueClass }: { label: string; value: string; foot: ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-3.5">
      <p className="text-sm text-ink-dim">{label}</p>
      <p className={cn("font-display text-[32px] font-extrabold leading-[1.1]", valueClass)}>{value}</p>
      <div className="text-[13px] text-ink-faint">{foot}</div>
    </div>
  );
}

function DaysChange({ data, long }: { data: Data; long?: boolean }) {
  const { t } = useLang();
  if (data.daysToPay === null || data.daysToPayBefore === null) return <span>{t("90 दिन का औसत", "90-day average")}</span>;
  const diff = data.daysToPay - data.daysToPayBefore;
  if (diff === 0) return <span>{t("पिछली तिमाही जितना", "same as last quarter")}</span>;
  const better = diff < 0;
  return (
    <span className={better ? "text-money" : "text-danger-soft"}>
      {better ? "↓" : "↑"} {Math.abs(diff)} {t("दिन", "days")}
      {long && ` ${t("पिछली तिमाही से", "vs last quarter")}`}
    </span>
  );
}

function BagsChange({ data, long }: { data: Data; long?: boolean }) {
  const { t } = useLang();
  const { period } = useDashboardFilters();
  if (data.bagsInChange === null) return <span>{period === "month" ? t("इस महीने", "this month") : t("90 दिन", "90 days")}</span>;
  const up = data.bagsInChange >= 0;
  return (
    <span className="text-count-soft">
      {up ? "↑" : "↓"} {Math.abs(data.bagsInChange)}% {period === "month" ? t("इस महीने", "this month") : t("90 दिन", "90 days")}
      {long && data.behind >= 2 && ` — ${t("गिनती पीछे चल रही है", "counting is behind")}`}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop                                                             */
/* ------------------------------------------------------------------ */

function DesktopDashboard({ data }: { data: Data }) {
  const { t, lang } = useLang();
  const userName = useSession().user?.name ?? "";
  const { period } = useDashboardFilters();
  const monthLabel = period === "month" ? t("इस महीने मिला", "Received this month") : t("90 दिन में मिला", "Received in 90 days");
  const maxBucket = Math.max(1, ...data.buckets.map((b) => b.value));

  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-[34px] font-extrabold leading-[1.1]">
            {t(`नमस्ते ${userName} — पैसा कहाँ अटका है?`, `Hello ${userName} — where is the money stuck?`)}
          </h1>
          <p className="mt-0.5 text-base text-ink-dim">
            {t("Where your damage money is stuck today", "आज आपका डैमेज का पैसा कहाँ अटका है")} · {longDate(today(), lang)}
          </p>
        </div>
        <p className="text-[15px] text-ink-dim">
          {t("कुल अटका हुआ · Total stuck", "Total stuck · कुल अटका हुआ")}
          <b className="ml-1.5 font-display text-[28px] text-ink">{lakh(data.stuck, lang)}</b>
        </p>
      </div>

      <section aria-label="Money by stage" className={cn(card, "rounded-[22px] p-5")}>
        <StageBar data={data} height={28} />
        <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3">
          {data.stages.map((s, i) => (
            <Link key={s.key} href={s.href} className={cn("rounded-2xl border-t-4 bg-elevated p-3.5 transition-colors hover:bg-raised", STAGE[s.key].border)}>
              <p className={cn("text-[15px] font-bold", STAGE[s.key].text)}>
                {i + 1} · {t(s.hi, s.en)}
              </p>
              <p className="mt-0.5 font-display text-[30px] font-extrabold leading-[1.1]">
                {s.estimate ? "~" : ""}
                {lakh(s.value, lang)}
              </p>
              <p className="text-sm text-ink-dim">
                {s.count} · {s.note}
              </p>
            </Link>
          ))}
          <Link href="/money" className="rounded-2xl border-t-4 border-t-money bg-money-tint p-3.5">
            <p className="text-[15px] font-bold text-money-soft">✓ {monthLabel}</p>
            <p className="mt-0.5 font-display text-[30px] font-extrabold leading-[1.1] text-money">{lakh(data.receivedInPeriod, lang)}</p>
            <p className="text-sm text-money-mute">{lang === "hi" ? (period === "month" ? "Received this month" : "Received in 90 days") : monthLabel === "Received this month" ? "इस महीने मिला" : "90 दिन में मिला"}</p>
          </Link>
        </div>
      </section>

      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3">
        <BigKey
          label={t("रिकवरी · Recovery rate (90 दिन)", "Recovery rate (90 days)")}
          value={data.recovery === null ? "—" : `${data.recovery}%`}
          valueClass={recoveryTone(data.recovery)}
          foot={`${lakhShort(data.claimed90, 1)} ${t("क्लेम", "claimed")} → ${lakhShort(data.received90, 1)} ${t("मिला", "received")}`}
        />
        <BigKey
          label={t("पैसा आने में · Days to get paid", "Days to get paid")}
          value={data.daysToPay === null ? "—" : `${data.daysToPay} ${t("दिन", "days")}`}
          foot={<DaysChange data={data} long />}
        />
        <BigKey
          label={t("फैक्ट्री की कटौती · Short payments", "Short payments")}
          value={lakhShort(data.deductions)}
          valueClass="text-danger-icon"
          foot={t(`${data.deductionRuns} गाड़ियों में · this quarter`, `across ${data.deductionRuns} runs · this quarter`)}
        />
        <BigKey
          label={period === "month" ? t("इस महीने पिकअप · Bags collected", "Bags collected this month") : t("90 दिन में पिकअप · Bags collected", "Bags collected in 90 days")}
          value={num(data.bagsIn)}
          foot={<BagsChange data={data} long />}
        />
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4">
        <section aria-label="Needs attention" className={cn(card, "flex flex-col gap-2.5 rounded-[22px] p-5")}>
          <h2 className="mb-1 font-display text-[22px] font-extrabold">
            {t("ध्यान दें", "Needs attention")} <span className="font-sans text-[15px] font-medium text-ink-faint">· {t("Needs attention", "ध्यान दें")}</span>
          </h2>
          {data.alerts.length === 0 && <p className="text-ink-dim">{t("सब ठीक है ✓", "All clear ✓")}</p>}
          {data.alerts.slice(0, 6).map((a) => (
            <AlertRow key={a.title} alert={a} desktop />
          ))}
        </section>
        <section aria-label="Weekly flow" className={cn(card, "rounded-[22px] p-5")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[22px] font-extrabold">
              {t("हर हफ़्ते", "Every week")} <span className="font-sans text-[15px] font-medium text-ink-faint">· {t("Bags in vs counted", "आए vs गिने")}</span>
            </h2>
            <Legend />
          </div>
          <WeeklyBars data={data} height={200} labels="all" />
          <BehindNote data={data} />
        </section>
      </div>

      <section aria-label="Company wise" className={cn(card, "rounded-[22px] p-5")}>
        <h2 className="mb-3 font-display text-[22px] font-extrabold">
          {t("कंपनी के हिसाब से", "By company")} <span className="font-sans text-[15px] font-medium text-ink-faint">· {t("By company", "कंपनी के हिसाब से")}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-base">
            <thead>
              <tr className="text-left text-sm text-ink-dim">
                <th className="px-2 py-2.5 font-semibold">{t("कंपनी", "Company")}</th>
                <th className="px-2 py-2.5 font-semibold text-count-soft">{t("गिनती बाकी", "To count")}</th>
                <th className="px-2 py-2.5 font-semibold text-pile-soft">{t("भर रहे बैग में", "In bags filling")}</th>
                <th className="px-2 py-2.5 font-semibold text-factory-soft">{t("तैयार बैग", "Ready bags")}</th>
                <th className="px-2 py-2.5 font-semibold text-pickup-soft">{t("फैक्ट्री के पास", "With factory")}</th>
                <th className="px-2 py-2.5 font-semibold text-money-soft">{period === "month" ? t("इस महीने मिला", "Received this month") : t("90 दिन में मिला", "Received, 90 days")}</th>
                <th className="px-2 py-2.5 font-semibold">{t("रिकवरी", "Recovery")}</th>
                <th className="px-2 py-2.5 font-semibold">{t("आख़िरी गाड़ी", "Last run")}</th>
              </tr>
            </thead>
            <tbody>
              {data.companyRows.map((r) => {
                const dash = <span className="text-ink-faint">—</span>;
                return (
                  <tr key={r.company.id} className="border-t border-line">
                    <td className="px-2 py-3">
                      <span className="flex items-center gap-2.5 font-bold">
                        <CompanyAvatar company={r.company} size={34} />
                        {r.company.name}
                      </span>
                    </td>
                    <td className="px-2 py-3">{r.uncounted ? `${r.uncounted} ${t("बैग", "bags")}` : dash}</td>
                    <td className="px-2 py-3">{r.pilePieces ? num(r.pilePieces) : dash}</td>
                    <td className="px-2 py-3">{r.ready ? `${r.ready} · ${lakhShort(r.readyValue)}` : dash}</td>
                    <td className="px-2 py-3">
                      {r.owedRuns ? (
                        <>
                          {lakhShort(r.owedValue)} <span className="text-ink-faint">({r.owedRuns})</span>
                        </>
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="px-2 py-3 text-money">{r.received ? lakhShort(r.received) : dash}</td>
                    <td className={cn("px-2 py-3 font-bold", recoveryTone(r.recovery))}>{r.recovery === null ? "—" : `${r.recovery}%`}</td>
                    <td className={cn("px-2 py-3", r.lateClaim && "font-bold text-danger-soft")}>
                      {r.lastRun === null ? dash : r.lastRun === 0 ? t("आज", "Today") : `${r.lastRun} ${t("दिन", "days")}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
        <section aria-label="Damage by party" className={cn(card, "rounded-[22px] p-5")}>
          <h2 className="font-display text-xl font-extrabold">{t("किस पार्टी से ज़्यादा डैमेज", "Most damage by party")}</h2>
          <p className="mb-3.5 text-sm text-ink-faint">{t("Damage value by party · 90 दिन", "Damage value by party · 90 days")}</p>
          <PartyBars data={data} />
        </section>
        <section aria-label="Top damaged items" className={cn(card, "rounded-[22px] p-5")}>
          <h2 className="font-display text-xl font-extrabold">{t("सबसे ज़्यादा ख़राब सामान", "Most damaged items")}</h2>
          <p className="mb-3.5 text-sm text-ink-faint">{t("Top damaged items · pieces, 90 दिन", "Top damaged items · pieces, 90 days")}</p>
          <div className="flex flex-col gap-2.5 text-[15px]">
            {data.items.map((r) => (
              <div key={r.product!.id} className="flex items-center gap-2.5">
                <MrpCircle mrp={r.product!.mrp} size={32} />
                <span className="flex-1 truncate">{r.product!.name}</span>
                <b>{num(r.pieces)}</b>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Claim age" className={cn(card, "rounded-[22px] p-5")}>
          <h2 className="font-display text-xl font-extrabold">{t("पैसा कितने दिन से अटका", "How long money has been stuck")}</h2>
          <p className="mb-3.5 text-sm text-ink-faint">
            {t("Pending claims by age", "बाकी क्लेम, दिनों के हिसाब से")} · {lakhShort(data.owedValue, 1)}
          </p>
          <div role="img" aria-label="Pending claims by age" className="flex h-[150px] items-end gap-3 border-b border-line">
            {data.buckets.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                <b className="text-[15px]">{lakhShort(b.value, 1)}</b>
                <span className="w-full rounded-t-md" style={{ height: Math.max(b.value ? 6 : 0, (b.value / maxBucket) * 100), background: b.color }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-3 text-center text-[13px] text-ink-faint">
            {data.buckets.map((b) => (
              <span key={b.label} className="flex-1">
                {b.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section aria-label="Today" className={cn(card, "rounded-[22px] p-5")}>
        <h2 className="mb-3 font-display text-xl font-extrabold">
          {t("आज टीम का काम", "Team today")} <span className="font-sans text-[15px] font-medium text-ink-faint">· {t("Team today", "आज टीम का काम")}</span>
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
          {data.team.map((m) => {
            const parts = [
              m.bagsIn ? t(`${m.pickups} पिकअप · ${m.bagsIn} बैग लाए`, `${m.pickups} pickups · ${m.bagsIn} bags in`) : null,
              m.counted ? t(`${m.counted} बैग गिने`, `${m.counted} bags counted`) : null,
              m.tied ? t(`${m.tied} बाँधे`, `${m.tied} tied`) : null,
              m.sent ? t(`${m.sent} गाड़ी भेजी`, `${m.sent} runs sent`) : null,
              m.godown ? t(`${m.godown} गोदाम एंट्री`, `${m.godown} godown entries`) : null,
            ].filter(Boolean);
            return (
              <TodayTile
                key={m.user.id}
                tone={m.user.role === "admin" ? "bg-money-tint text-money" : "bg-count-tint text-count"}
                letter={m.user.name.slice(0, 1)}
                title={m.user.name}
                line={parts.length ? parts.join(" · ") : t("आज अभी कुछ दर्ज नहीं", "Nothing logged yet today")}
              />
            );
          })}
        </div>
      </section>

      <Link href="/analytics" className="self-start text-[15px] font-bold text-ink-dim hover:text-ink">
        {t("विस्तृत रिपोर्ट और एक्सपोर्ट →", "Detailed reports and exports →")}
      </Link>
    </main>
  );
}

function BigKey({ label, value, foot, valueClass }: { label: string; value: string; foot: ReactNode; valueClass?: string }) {
  return (
    <div className={cn(card, "p-[18px]")}>
      <p className="text-[15px] text-ink-dim">{label}</p>
      <p className={cn("mt-1 font-display text-[40px] font-extrabold leading-none", valueClass)}>{value}</p>
      <div className="mt-1.5 text-sm text-ink-dim">{foot}</div>
    </div>
  );
}

function TodayTile({ tone, letter, title, line }: { tone: string; letter: string; title: string; line: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-elevated p-3">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-full font-display text-lg font-extrabold", tone)}>{letter}</span>
      <span>
        <b className="block text-base">{title}</b>
        <span className="text-sm text-ink-dim">{line}</span>
      </span>
    </div>
  );
}
