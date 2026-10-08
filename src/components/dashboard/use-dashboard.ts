"use client";
import { lineValue } from "@/lib/claim";

import { useMemo } from "react";
import { addDays, daysSince, lakhShort, num } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import {
  BAG_CAPACITY,
  NEAR_FULL,
  STALE_CLAIM_DAYS,
  STALE_COUNT_DAYS,
  STALE_READY_DAYS,
  averageDaysToPay,
  awaitingPayment,
  monthStart,
  openBags,
  quarterStart,
  readyBags,
  shortfall,
  sumValue,
  uncountedEstimate,
  weeklyFlow,
} from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { today } from "@/lib/utils";
import type { Period } from "@/components/layout/dashboard-filters";

export type AlertLevel = "red" | "yellow" | "blue";
export interface Alert {
  level: AlertLevel;
  href: string;
  title: string;
  detail: string;
}

/**
 * Everything the owner dashboard shows, worked out once for both the phone
 * and the desktop layout so the two can never show different numbers.
 */
export function useDashboard(companyId: string, period: Period, lang: Lang) {
  const store = useStore();

  return useMemo(() => {
    const { companies, collections, countLines, sortedBags, dispatches, distributors, products, users, records } = store;
    const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
    const inScope = (id: string) => companyId === "all" || id === companyId;
    const now = today();
    const from = period === "month" ? monthStart(now) : addDays(now, -89);
    const span = Math.max(1, daysSince(from) + 1);
    const prevFrom = addDays(from, -span);
    const since90 = addDays(now, -89);

    const cols = collections.filter((c) => inScope(c.companyId));
    const lines = countLines.filter((l) => inScope(l.companyId));
    const disp = dispatches.filter((d) => inScope(d.companyId));

    // ---- Where the money is stuck, step by step -------------------
    const uncounted = cols.filter((c) => c.status === "uncounted");
    // An estimate, so it is rounded rather than shown to the rupee.
    const uncountedValue = Math.round(uncountedEstimate(uncounted, countLines, collections) / 100) * 100;
    // Counted pieces sit in numbered bags still being filled until a bag reaches 700.
    const filling = openBags(sortedBags).filter((b) => inScope(b.companyId));
    const loosePieces = filling.reduce((s, b) => s + b.pieceCount, 0);
    const looseValue = sumValue(filling);
    const ready = readyBags(sortedBags).filter((b) => inScope(b.companyId));
    const readyValue = sumValue(ready);
    const owed = awaitingPayment(disp);
    const owedValue = owed.reduce((s, d) => s + d.claimedValue, 0);
    const stuck = uncountedValue + looseValue + readyValue + owedValue;
    const receivedInPeriod = disp.filter((d) => d.settledDate && d.settledDate >= from).reduce((s, d) => s + (d.receivedValue ?? 0), 0);

    const stages = [
      { key: "count", href: "/count", value: uncountedValue, hi: "गिनती बाकी", en: "Not counted", count: `${uncounted.length} ${t("बैग", "bags")}`, note: t("Not counted (estimate)", "अंदाज़ा"), estimate: true },
      { key: "pile", href: "/piles", value: looseValue, hi: "भर रहे बैग में", en: "In bags being filled", count: `${filling.length} ${t("बैग", "bags")} · ${num(loosePieces)} ${t("पीस", "pcs")}`, note: t("In bags being filled", "भर रहे बैग में"), estimate: false },
      { key: "factory", href: "/send", value: readyValue, hi: "भेजने को तैयार", en: "Ready, not sent", count: `${ready.length} ${t("बैग", "bags")}`, note: t("Ready, not sent", "भेजने को तैयार"), estimate: false },
      { key: "pickup", href: "/money", value: owedValue, hi: "फैक्ट्री के पास", en: "With the factory", count: `${owed.length} ${t("गाड़ी", "runs")}`, note: t("Awaiting payment", "पैसा आना बाकी"), estimate: false },
    ] as const;

    // ---- Key numbers ------------------------------------------------
    const answered90 = disp.filter((d) => d.settledDate && d.settledDate >= since90);
    const claimed90 = answered90.reduce((s, d) => s + d.claimedValue, 0);
    const received90 = answered90.reduce((s, d) => s + (d.receivedValue ?? 0), 0);
    const recovery = claimed90 ? Math.round((received90 / claimed90) * 100) : null;
    const daysToPay = averageDaysToPay(disp, since90);
    const daysToPayBefore = averageDaysToPay(disp, addDays(now, -179), addDays(now, -90));
    const quarter = disp.filter((d) => d.settledDate && d.settledDate >= quarterStart(now) && shortfall(d) > 0);
    const deductions = quarter.reduce((s, d) => s + shortfall(d), 0);
    const bagsIn = cols.filter((c) => c.collectedDate >= from).length;
    const bagsInBefore = cols.filter((c) => c.collectedDate >= prevFrom && c.collectedDate < from).length;
    const bagsInChange = bagsInBefore ? Math.round(((bagsIn - bagsInBefore) / bagsInBefore) * 100) : null;

    // ---- Needs attention -------------------------------------------
    const alerts: Alert[] = [];
    owed
      .filter((d) => daysSince(d.sentDate) >= STALE_CLAIM_DAYS)
      .forEach((d) => {
        const c = companies.find((x) => x.id === d.companyId);
        alerts.push({
          level: "red",
          href: "/money",
          title: t(`${c?.name} का ${lakhShort(d.claimedValue)} का क्लेम ${daysSince(d.sentDate)} दिन से अटका`, `${c?.name}'s ${lakhShort(d.claimedValue)} claim stuck for ${daysSince(d.sentDate)} days`),
          detail: `${d.dispatchNumber}${c?.claimContact ? ` · ${t("फ़ोन करें", "call the")} ${c.claimContact}` : ""}`,
        });
      });
    const stale = uncounted.filter((c) => daysSince(c.collectedDate) >= STALE_COUNT_DAYS).sort((a, b) => a.collectedDate.localeCompare(b.collectedDate));
    if (stale.length) {
      alerts.push({
        level: "red",
        href: "/count",
        title: t(`${stale.length} बैग ${STALE_COUNT_DAYS} दिन से बिना गिने पड़े हैं`, `${stale.length} bags uncounted for over ${STALE_COUNT_DAYS} days`),
        detail: `${t("सबसे पुराना", "Oldest")}: ${stale[0].bagNumber} · ${daysSince(stale[0].collectedDate)} ${t("दिन", "days")}`,
      });
    }
    companies.forEach((c) => {
      const theirs = ready.filter((b) => b.companyId === c.id);
      if (!theirs.length) return;
      const oldest = Math.max(...theirs.map((b) => daysSince(b.createdDate)));
      if (oldest < STALE_READY_DAYS) return;
      alerts.push({
        level: "yellow",
        href: `/send?company=${c.id}`,
        title: t(`${c.name} के ${theirs.length} बैग ${oldest} दिन से तैयार, भेजे नहीं`, `${theirs.length} ${c.name} bags ready for ${oldest} days, not sent`),
        detail: t(`${lakhShort(sumValue(theirs))} गोदाम में पड़ा है`, `${lakhShort(sumValue(theirs))} sitting in the godown`),
      });
    });
    filling
      .filter((b) => BAG_CAPACITY - b.pieceCount <= NEAR_FULL)
      .forEach((b) => {
        const c = companies.find((x) => x.id === b.companyId);
        alerts.push({
          level: "yellow",
          href: `/piles?company=${b.companyId}`,
          title: t(
            `${b.bagNumber} में ${b.pieceCount}/${BAG_CAPACITY} — ${BAG_CAPACITY - b.pieceCount} पीस से बैग भरेगा`,
            `${b.bagNumber} has ${b.pieceCount}/${BAG_CAPACITY} — ${BAG_CAPACITY - b.pieceCount} pieces to a full bag`
          ),
          detail: t(`पहले ${c?.name} का एक और बैग गिनें`, `Count one more ${c?.name} bag first`),
        });
      });
    disp
      .filter((d) => d.settledDate && daysSince(d.settledDate) <= 30 && shortfall(d) > 0)
      .forEach((d) => {
        const c = companies.find((x) => x.id === d.companyId);
        alerts.push({
          level: "blue",
          href: "/money",
          title: t(`${c?.name} ने ${lakhShort(shortfall(d))} कम दिए`, `${c?.name} paid ${lakhShort(shortfall(d))} short`),
          detail: `${d.dispatchNumber} · ${t("कटौती का कारण माँगें", "ask for the deduction note")}`,
        });
      });
    const order: Record<AlertLevel, number> = { red: 0, yellow: 1, blue: 2 };
    alerts.sort((a, b) => order[a.level] - order[b.level]);

    // ---- Weekly flow -----------------------------------------------
    const weeks = weeklyFlow(cols, 8);
    let behind = 0;
    for (let i = weeks.length - 1; i >= 0 && weeks[i].counted < weeks[i].came; i -= 1) behind += 1;

    // ---- Per company -----------------------------------------------
    const companyRows = companies
      .filter((c) => inScope(c.id))
      .map((c) => {
        const theirs = dispatches.filter((d) => d.companyId === c.id);
        const answered = theirs.filter((d) => d.settledDate && d.settledDate >= since90);
        const claimed = answered.reduce((s, d) => s + d.claimedValue, 0);
        const paid = answered.reduce((s, d) => s + (d.receivedValue ?? 0), 0);
        const owedRuns = awaitingPayment(theirs);
        const last = theirs.map((d) => d.sentDate).sort().pop();
        const ready = readyBags(sortedBags, c.id);
        return {
          company: c,
          uncounted: collections.filter((x) => x.companyId === c.id && x.status === "uncounted").length,
          pilePieces: openBags(sortedBags, c.id).reduce((s, b) => s + b.pieceCount, 0),
          ready: ready.length,
          readyValue: sumValue(ready),
          owedValue: owedRuns.reduce((s, d) => s + d.claimedValue, 0),
          owedRuns: owedRuns.length,
          received: theirs.filter((d) => d.settledDate && d.settledDate >= from).reduce((s, d) => s + (d.receivedValue ?? 0), 0),
          recovery: claimed ? Math.round((paid / claimed) * 100) : null,
          lastRun: last ? daysSince(last) : null,
          lateClaim: owedRuns.some((d) => daysSince(d.sentDate) >= STALE_CLAIM_DAYS),
        };
      })
      .filter((r) => r.uncounted || r.pilePieces || r.ready || r.owedValue || r.received || r.lastRun !== null);

    // ---- Damage by party and by item (last 90 days of pickups) ------
    const recent = new Set(cols.filter((c) => c.collectedDate >= since90).map((c) => c.id));
    const recentLines = lines.filter((l) => recent.has(l.collectionId));
    const byParty = new Map<string, number>();
    recentLines.forEach((l) => {
      const party = collections.find((c) => c.id === l.collectionId)?.distributorId ?? "";
      byParty.set(party, (byParty.get(party) ?? 0) + lineValue(l));
    });
    const parties = Array.from(byParty.entries())
      .map(([id, value]) => ({ name: distributors.find((d) => d.id === id)?.name ?? "—", value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const byItem = new Map<string, number>();
    recentLines.forEach((l) => byItem.set(l.productId, (byItem.get(l.productId) ?? 0) + l.quantity));
    const items = Array.from(byItem.entries())
      .map(([id, pieces]) => ({ product: products.find((p) => p.id === id), pieces }))
      .filter((r) => r.product)
      .sort((a, b) => b.pieces - a.pieces)
      .slice(0, 5);

    // ---- Pending claims by age ---------------------------------------
    const buckets = [
      { label: t("0–30 दिन", "0–30 days"), min: 0, max: 30, color: "#3DDC97" },
      { label: "31–60", min: 31, max: 60, color: "#FFC24D" },
      { label: "61–90", min: 61, max: 90, color: "#FF9F5A" },
      { label: "90+", min: 91, max: Infinity, color: "#FF6B6B" },
    ].map((b) => ({ ...b, value: owed.filter((d) => daysSince(d.sentDate) >= b.min && daysSince(d.sentDate) <= b.max).reduce((s, d) => s + d.claimedValue, 0) }));

    // ---- Today ------------------------------------------------------
    // Each change is stamped with who made it, so today's work is per person.
    const team = users
      .filter((u) => u.isActive)
      .map((u) => {
        const brought = cols.filter((c) => c.collectedDate === now && c.loggedBy === u.id);
        return {
          user: u,
          bagsIn: brought.length,
          pickups: new Set(brought.map((c) => `${c.companyId}:${c.distributorId}`)).size,
          counted: cols.filter((c) => c.countedDate === now && c.countedBy === u.id).length,
          tied: sortedBags.filter((b) => inScope(b.companyId) && b.createdDate === now && b.tiedBy === u.id).length,
          sent: disp.filter((d) => d.sentDate === now && d.sentBy === u.id).length,
          godown: records.filter((r) => r.date === now && r.loggedBy === u.id).length,
        };
      });

    return {
      stuck,
      stages,
      receivedInPeriod,
      recovery,
      claimed90,
      received90,
      daysToPay,
      daysToPayBefore,
      deductions,
      deductionRuns: quarter.length,
      bagsIn,
      bagsInChange,
      alerts,
      weeks,
      behind,
      uncountedNow: uncounted.length,
      companyRows,
      parties,
      items,
      buckets,
      owedValue,
      team,
    };
  }, [store, companyId, period, lang]);
}
