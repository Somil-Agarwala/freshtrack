import { bagValue, lineValue } from "./claim";
import { BAG_CAPACITY } from "./bag-packing";
import { formatCurrency, formatNumber } from "./utils";
import { REASON_LABELS } from "./constants";
import type {
  CollectionBag,
  Company,
  CountLine,
  DamageRecord,
  Dispatch,
  Distributor,
  Product,
  SortedBag,
} from "@/types";

/**
 * Every derived number in the app, computed here and nowhere else.
 *
 * All functions are pure: they take the rows they need and return plain
 * objects. That keeps them trivially testable, and means they map 1:1 onto
 * SQL views when Supabase takes over -- each one becomes a view or an RPC
 * with the same name and the same shape.
 */

export interface Dataset {
  companies: Company[];
  products: Product[];
  distributors: Distributor[];
  collections: CollectionBag[];
  countLines: CountLine[];
  sortedBags: SortedBag[];
  dispatches: Dispatch[];
  records: DamageRecord[];
}

const DAY = 86400000;

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY);
}
function daysSince(from: string): number {
  return Math.round((Date.now() - new Date(from).getTime()) / DAY);
}
function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}
/** Scopes a dataset to one company, or returns it whole for "all". */
export function scopeToCompany(d: Dataset, companyId: string | "all"): Dataset {
  if (companyId === "all") return d;
  const collections = d.collections.filter((c) => c.companyId === companyId);
  const ids = new Set(collections.map((c) => c.id));
  return {
    ...d,
    collections,
    countLines: d.countLines.filter((l) => ids.has(l.collectionId)),
    sortedBags: d.sortedBags.filter((b) => b.companyId === companyId),
    dispatches: d.dispatches.filter((x) => x.companyId === companyId),
    records: d.records.filter((r) => r.companyId === companyId),
    products: d.products.filter((p) => p.companyId === companyId),
  };
}

/* ---------------------------------------------------------------- */
/* 1. PIPELINE -- where stock and value are sitting right now        */
/* ---------------------------------------------------------------- */

export interface PipelineStage {
  stage: string;
  bags: number;
  pieces: number;
  value: number;
  /** The screen that clears this stage. */
  href: string;
}

export function pipeline(d: Dataset): PipelineStage[] {
  const uncounted = d.collections.filter((c) => c.status === "uncounted");
  const filling = d.sortedBags.filter((b) => b.status === "open");
  const ready = d.sortedBags.filter((b) => b.status === "ready");
  const openDispatches = d.dispatches.filter((x) => x.status === "sent" || x.status === "under_review");

  return [
    {
      stage: "Not counted",
      bags: uncounted.length,
      // Rough count only -- these bags have not been opened yet.
      pieces: uncounted.reduce((s, c) => s + (c.estimatedPieces ?? 0), 0),
      value: 0,
      href: "/collections",
    },
    {
      stage: "In bags being filled",
      bags: filling.length,
      pieces: filling.reduce((s, b) => s + b.pieceCount, 0),
      value: filling.reduce((s, b) => s + bagValue(b), 0),
      href: "/piles",
    },
    {
      stage: "Ready to send",
      bags: ready.length,
      pieces: ready.reduce((s, b) => s + b.pieceCount, 0),
      value: ready.reduce((s, b) => s + bagValue(b), 0),
      href: "/sorted-bags",
    },
    {
      stage: "At factory, unsettled",
      bags: openDispatches.reduce((s, x) => s + x.bagCount, 0),
      pieces: openDispatches.reduce((s, x) => s + x.pieceCount, 0),
      value: openDispatches.reduce((s, x) => s + (x.claimedValue - (x.receivedValue ?? 0)), 0),
      href: "/dispatches",
    },
  ];
}

/** Uncounted bags bucketed by how long they have been waiting. */
export function countingBacklog(d: Dataset) {
  const buckets = [
    { label: "0-3 days", min: 0, max: 3 },
    { label: "4-7 days", min: 4, max: 7 },
    { label: "8-14 days", min: 8, max: 14 },
    { label: "15+ days", min: 15, max: Infinity },
  ];
  const uncounted = d.collections.filter((c) => c.status === "uncounted");
  return buckets.map((b) => {
    const rows = uncounted.filter((c) => {
      const age = daysSince(c.collectedDate);
      return age >= b.min && age <= b.max;
    });
    return { label: b.label, bags: rows.length, pieces: rows.reduce((s, c) => s + (c.estimatedPieces ?? 0), 0) };
  });
}

/* ---------------------------------------------------------------- */
/* 2. CLAIMS & RECOVERY -- did the money actually come back          */
/* ---------------------------------------------------------------- */

export interface ClaimRow {
  companyId: string;
  company: string;
  dispatches: number;
  claimed: number;
  received: number;
  shortfall: number;
  /** Of settled claims only, so open ones do not drag the rate down. */
  recoveryPct: number;
  /** Mean days from sent to settled. Null while nothing has settled. */
  avgSettlementDays: number | null;
}

export function claimsByCompany(d: Dataset): ClaimRow[] {
  return d.companies
    .map((co) => {
      const rows = d.dispatches.filter((x) => x.companyId === co.id);
      const settled = rows.filter((x) => x.receivedValue != null);
      const claimedOnSettled = settled.reduce((s, x) => s + x.claimedValue, 0);
      const received = settled.reduce((s, x) => s + (x.receivedValue ?? 0), 0);
      const lags = rows
        .filter((x) => x.settledDate)
        .map((x) => daysBetween(x.sentDate, x.settledDate as string));
      return {
        companyId: co.id,
        company: co.name,
        dispatches: rows.length,
        claimed: rows.reduce((s, x) => s + x.claimedValue, 0),
        received,
        shortfall: claimedOnSettled - received,
        recoveryPct: claimedOnSettled > 0 ? (received / claimedOnSettled) * 100 : 0,
        avgSettlementDays: lags.length > 0 ? Math.round(mean(lags)) : null,
      };
    })
    .filter((r) => r.dispatches > 0)
    .sort((a, b) => b.claimed - a.claimed);
}

export function recoveryHeadline(d: Dataset) {
  const settled = d.dispatches.filter((x) => x.receivedValue != null);
  const claimedOnSettled = settled.reduce((s, x) => s + x.claimedValue, 0);
  const received = settled.reduce((s, x) => s + (x.receivedValue ?? 0), 0);
  const open = d.dispatches.filter((x) => x.receivedValue == null);
  return {
    claimedAllTime: d.dispatches.reduce((s, x) => s + x.claimedValue, 0),
    received,
    shortfall: claimedOnSettled - received,
    recoveryPct: claimedOnSettled > 0 ? (received / claimedOnSettled) * 100 : 0,
    openValue: open.reduce((s, x) => s + x.claimedValue, 0),
    openCount: open.length,
  };
}

/* ---------------------------------------------------------------- */
/* 3. PARTIES -- who the damage is coming from                       */
/* ---------------------------------------------------------------- */

export interface PartyRow {
  partyId: string;
  party: string;
  region: string;
  bags: number;
  pieces: number;
  value: number;
  sharePct: number;
  /** Counted minus rough count, as a % of rough. Negative = came up short. */
  countVariancePct: number | null;
}

export function partyBreakdown(d: Dataset): PartyRow[] {
  const total = d.countLines.reduce((s, l) => s + lineValue(l), 0);
  return d.distributors
    .map((party) => {
      const bags = d.collections.filter((c) => c.distributorId === party.id);
      const ids = new Set(bags.map((c) => c.id));
      const lines = d.countLines.filter((l) => ids.has(l.collectionId));
      const value = lines.reduce((s, l) => s + lineValue(l), 0);

      // Variance only over bags that were both estimated AND counted.
      const comparable = bags.filter((c) => c.estimatedPieces != null && c.status !== "uncounted");
      const est = comparable.reduce((s, c) => s + (c.estimatedPieces ?? 0), 0);
      const act = comparable.reduce(
        (s, c) => s + d.countLines.filter((l) => l.collectionId === c.id).reduce((t, l) => t + l.quantity, 0),
        0
      );

      return {
        partyId: party.id,
        party: party.name,
        region: party.region,
        bags: bags.length,
        pieces: lines.reduce((s, l) => s + l.quantity, 0),
        value,
        sharePct: total > 0 ? (value / total) * 100 : 0,
        countVariancePct: est > 0 ? ((act - est) / est) * 100 : null,
      };
    })
    .filter((r) => r.bags > 0)
    .sort((a, b) => b.value - a.value);
}

export function regionBreakdown(d: Dataset) {
  const map = new Map<string, { pieces: number; value: number; bags: number }>();
  d.collections.forEach((c) => {
    const region = d.distributors.find((x) => x.id === c.distributorId)?.region ?? "Unknown";
    const lines = d.countLines.filter((l) => l.collectionId === c.id);
    const e = map.get(region) ?? { pieces: 0, value: 0, bags: 0 };
    e.bags += 1;
    e.pieces += lines.reduce((s, l) => s + l.quantity, 0);
    e.value += lines.reduce((s, l) => s + lineValue(l), 0);
    map.set(region, e);
  });
  return Array.from(map.entries())
    .map(([region, v]) => ({ region, ...v }))
    .sort((a, b) => b.value - a.value);
}

/* ---------------------------------------------------------------- */
/* 4. PRODUCTS & MRP -- what is actually coming back                 */
/* ---------------------------------------------------------------- */

export function topSkus(d: Dataset, limit = 10) {
  const map = new Map<string, { pieces: number; value: number }>();
  d.countLines.forEach((l) => {
    const e = map.get(l.productId) ?? { pieces: 0, value: 0 };
    e.pieces += l.quantity;
    e.value += lineValue(l);
    map.set(l.productId, e);
  });
  return Array.from(map.entries())
    .map(([productId, v]) => {
      const p = d.products.find((x) => x.id === productId);
      return { productId, sku: p?.sku ?? "", name: p?.name ?? "Unknown", ...v };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function categoryBreakdown(d: Dataset) {
  const map = new Map<string, { pieces: number; value: number }>();
  d.countLines.forEach((l) => {
    const cat = d.products.find((p) => p.id === l.productId)?.category ?? "Uncategorised";
    const e = map.get(cat) ?? { pieces: 0, value: 0 };
    e.pieces += l.quantity;
    e.value += lineValue(l);
    map.set(cat, e);
  });
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.value - a.value);
}

/** Pieces and bags per MRP tier -- the shape of the claim itself. */
export function mrpBreakdown(d: Dataset) {
  const map = new Map<number, { pieces: number; bags: number; value: number }>();
  d.countLines.forEach((l) => {
    const e = map.get(l.mrp) ?? { pieces: 0, bags: 0, value: 0 };
    e.pieces += l.quantity;
    e.value += lineValue(l);
    map.set(l.mrp, e);
  });
  d.sortedBags.forEach((b) => {
    const e = map.get(b.mrp) ?? { pieces: 0, bags: 0, value: 0 };
    e.bags += 1;
    map.set(b.mrp, e);
  });
  return Array.from(map.entries())
    .map(([mrp, v]) => ({ mrp, label: `MRP ${mrp}`, ...v }))
    .sort((a, b) => a.mrp - b.mrp);
}

/* ---------------------------------------------------------------- */
/* 5. OPERATIONS -- how well the process is running                  */
/* ---------------------------------------------------------------- */

export function bagFill(d: Dataset) {
  // Bags still being filled are part-full by nature, so they are left out.
  const bags = d.sortedBags.filter((b) => b.status !== "open");
  const full = bags.filter((b) => b.isFull).length;
  const partial = bags.length - full;
  const pieces = bags.reduce((s, b) => s + b.pieceCount, 0);
  const capacity = bags.length * BAG_CAPACITY;
  return {
    bags: bags.length,
    full,
    partial,
    avgFillPct: bags.length > 0 ? (pieces / capacity) * 100 : 0,
    // Unused space across part-filled bags: the cost of fragmentation.
    wastedPieces: capacity - pieces,
  };
}

/** Mean days from pickup to counted, per company -- the real bottleneck. */
export function countTurnaround(d: Dataset) {
  return d.companies
    .map((co) => {
      const counted = d.collections.filter(
        (c) => c.companyId === co.id && c.countedDate != null
      );
      const lags = counted.map((c) => daysBetween(c.collectedDate, c.countedDate as string));
      const pending = d.collections.filter((c) => c.companyId === co.id && c.status === "uncounted");
      return {
        company: co.name,
        counted: counted.length,
        avgDays: lags.length > 0 ? Math.round(mean(lags)) : null,
        oldestPendingDays: pending.length > 0 ? Math.max(...pending.map((c) => daysSince(c.collectedDate))) : null,
      };
    })
    .filter((r) => r.counted > 0 || r.oldestPendingDays != null);
}

/** Rough-count accuracy: are pickups being estimated well? */
export function countAccuracy(d: Dataset) {
  const rows = d.collections
    .filter((c) => c.estimatedPieces != null && c.status !== "uncounted")
    .map((c) => {
      const actual = d.countLines.filter((l) => l.collectionId === c.id).reduce((s, l) => s + l.quantity, 0);
      const estimated = c.estimatedPieces as number;
      return {
        bagNumber: c.bagNumber,
        estimated,
        actual,
        variance: actual - estimated,
        variancePct: estimated > 0 ? ((actual - estimated) / estimated) * 100 : 0,
      };
    });
  return {
    rows: rows.sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct)),
    meanAbsPct: rows.length > 0 ? mean(rows.map((r) => Math.abs(r.variancePct))) : 0,
  };
}

/* ---------------------------------------------------------------- */
/* 6. OWN INVENTORY -- damage that never came from a party           */
/* ---------------------------------------------------------------- */

export function ownLossByReason(d: Dataset) {
  const map = new Map<string, { qty: number; value: number }>();
  d.records.forEach((r) => {
    const label = REASON_LABELS[r.reason];
    const e = map.get(label) ?? { qty: 0, value: 0 };
    e.qty += r.quantity;
    e.value += r.costValue;
    map.set(label, e);
  });
  return Array.from(map.entries())
    .map(([reason, v]) => ({ reason, ...v }))
    .sort((a, b) => b.value - a.value);
}

export function ownLossByResponsible(d: Dataset) {
  const map = new Map<string, number>();
  d.records.forEach((r) => map.set(r.responsibleParty, (map.get(r.responsibleParty) ?? 0) + r.costValue));
  return Array.from(map.entries())
    .map(([party, value]) => ({ party, value }))
    .sort((a, b) => b.value - a.value);
}

/* ---------------------------------------------------------------- */
/* 7. TREND -- the last N months                                     */
/* ---------------------------------------------------------------- */

export function monthlyTrend(d: Dataset, months = 6) {
  const keys: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({
      key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
      label: dt.toLocaleString("en-IN", { month: "short" }),
    });
  }
  const monthOf = (iso: string) => iso.slice(0, 7);

  return keys.map(({ key, label }) => {
    const collected = d.collections.filter((c) => monthOf(c.collectedDate) === key);
    const ids = new Set(collected.map((c) => c.id));
    const sent = d.dispatches.filter((x) => monthOf(x.sentDate) === key);
    const settled = d.dispatches.filter((x) => x.settledDate && monthOf(x.settledDate) === key);
    return {
      month: label,
      collectedBags: collected.length,
      countedPieces: d.countLines.filter((l) => ids.has(l.collectionId)).reduce((s, l) => s + l.quantity, 0),
      claimed: sent.reduce((s, x) => s + x.claimedValue, 0),
      received: settled.reduce((s, x) => s + (x.receivedValue ?? 0), 0),
    };
  });
}

/* ---------------------------------------------------------------- */
/* 8. INSIGHTS -- the numbers above, turned into findings            */
/* ---------------------------------------------------------------- */

export type InsightLevel = "critical" | "warning" | "info" | "good";

export interface Insight {
  level: InsightLevel;
  title: string;
  detail: string;
  /** Screen where the finding can be acted on. */
  href: string;
}

const LEVEL_ORDER: Record<InsightLevel, number> = { critical: 0, warning: 1, info: 2, good: 3 };

/**
 * Plain-language findings, most urgent first. Each rule reads the same
 * functions the charts use, so a finding can never disagree with a chart.
 * Thresholds are deliberately simple so the reason for every line is obvious.
 */
export function insights(d: Dataset): Insight[] {
  const out: Insight[] = [];

  // Money not coming back.
  claimsByCompany(d).forEach((c) => {
    const settledClaimed = c.received + c.shortfall;
    if (settledClaimed <= 0) return;
    if (c.recoveryPct < 50) {
      out.push({
        level: "critical",
        title:
          c.recoveryPct < 1
            ? `${c.company}: nothing recovered on settled claims`
            : `${c.company}: only ${c.recoveryPct.toFixed(0)}% recovered on settled claims`,
        detail: `${formatCurrency(settledClaimed)} claimed, ${formatCurrency(c.received)} received. Find out why before the next dispatch.`,
        href: "/dispatches",
      });
    } else if (c.recoveryPct < 95) {
      out.push({
        level: "warning",
        title: `${c.company} is short-paying: ${c.recoveryPct.toFixed(1)}% recovered`,
        detail: `${formatCurrency(c.shortfall)} lost across settled claims.`,
        href: "/dispatches",
      });
    }
  });

  const rec = recoveryHeadline(d);
  if (rec.openCount > 0) {
    out.push({
      level: "info",
      title: `${formatCurrency(rec.openValue)} awaiting settlement`,
      detail: `${rec.openCount} dispatch${rec.openCount === 1 ? "" : "es"} sent and not yet paid.`,
      href: "/dispatches",
    });
  }

  // Stock stuck before it can be claimed.
  const stale = countingBacklog(d).filter((b) => b.label === "8-14 days" || b.label === "15+ days");
  const staleBags = stale.reduce((s, b) => s + b.bags, 0);
  if (staleBags > 0) {
    out.push({
      level: "warning",
      title: `${staleBags} bag${staleBags === 1 ? "" : "s"} uncounted for over a week`,
      detail: "Uncounted stock cannot be packed or claimed. Count these first.",
      href: "/collections",
    });
  }

  const uncounted = d.collections.filter((c) => c.status === "uncounted").length;
  if (uncounted > 0 && staleBags === 0) {
    out.push({
      level: "info",
      title: `${uncounted} bag${uncounted === 1 ? "" : "s"} waiting to be counted`,
      detail: "All collected within the last week.",
      href: "/collections",
    });
  }

  const filling = d.sortedBags.filter((b) => b.status === "open");
  const fillingPieces = filling.reduce((s, b) => s + b.pieceCount, 0);
  if (fillingPieces > 0) {
    out.push({
      level: "info",
      title: `${formatNumber(fillingPieces)} counted pieces in ${filling.length} bag${filling.length === 1 ? "" : "s"} still being filled`,
      detail: `Worth ${formatCurrency(filling.reduce((s, b) => s + bagValue(b), 0))}; they go to the factory once full or closed before a run.`,
      href: "/piles",
    });
  }

  const ready = d.sortedBags.filter((b) => b.status === "ready");
  if (ready.length > 0) {
    out.push({
      level: "info",
      title: `${ready.length} bag${ready.length === 1 ? "" : "s"} ready for the factory`,
      detail: `${formatCurrency(ready.reduce((s, b) => s + bagValue(b), 0))} can be claimed on the next run.`,
      href: "/sorted-bags",
    });
  }

  // Process quality.
  const fill = bagFill(d);
  if (fill.bags > 0 && fill.avgFillPct < 85) {
    out.push({
      level: "warning",
      title: `Bags are only ${fill.avgFillPct.toFixed(0)}% full on average`,
      detail: `${formatNumber(fill.wastedPieces)} pieces of space unused. Packing less often lets tiers fill up.`,
      href: "/sorted-bags",
    });
  }

  partyBreakdown(d).forEach((p) => {
    if (p.countVariancePct != null && p.countVariancePct <= -10) {
      out.push({
        level: "warning",
        title: `${p.party}: bags came in ${Math.abs(p.countVariancePct).toFixed(0)}% short of the pickup estimate`,
        detail: "The real count was well below what was noted at pickup. Worth checking at the next collection.",
        href: "/collections",
      });
    }
  });

  // Where the damage comes from.
  // Only parties whose stock has actually been counted: an uncounted bag
  // reads as zero value and would inflate everyone else's share.
  const parties = partyBreakdown(d).filter((p) => p.value > 0);
  if (parties.length > 1 && parties[0].sharePct >= 35) {
    out.push({
      level: "info",
      title: `${parties[0].party} accounts for ${parties[0].sharePct.toFixed(0)}% of returns by value`,
      detail: `${formatCurrency(parties[0].value)} from one party.`,
      href: "/master-data/distributors",
    });
  }

  const sku = topSkus(d, 1)[0];
  if (sku) {
    out.push({
      level: "info",
      title: `Most-returned product: ${sku.name}`,
      detail: `${formatNumber(sku.pieces)} pieces, ${formatCurrency(sku.value)} at MRP.`,
      href: "/master-data/products",
    });
  }

  const loss = ownLossByReason(d)[0];
  if (loss) {
    out.push({
      level: "info",
      title: `Biggest own-stock loss: ${loss.reason}`,
      detail: `${formatCurrency(loss.value)} at cost across ${formatNumber(loss.qty)} units.`,
      href: "/records",
    });
  }

  if (!out.some((i) => i.level === "critical" || i.level === "warning")) {
    out.push({
      level: "good",
      title: "Nothing needs urgent attention",
      detail: "Recovery, counting backlog and bag fill are all within range.",
      href: "/",
    });
  }

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
