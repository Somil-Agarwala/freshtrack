import { BAG_CAPACITY, buildMrpTiers, type MrpTier } from "./bag-packing";
import { addDays, daysBetween, daysSince } from "./format";
import { today } from "./utils";
import type { CollectionBag, CountLine, Dispatch, SortedBag } from "@/types";

/**
 * Read-only views over the store that the redesigned screens share, so the
 * home screen, the dashboard and each step screen can never disagree about
 * how many bags are waiting or how much money is stuck.
 */

export const STALE_COUNT_DAYS = 7;
/** A factory claim older than this is chased. */
export const STALE_CLAIM_DAYS = 45;
/** Tied bags lying in the godown longer than this should go out. */
export const STALE_READY_DAYS = 14;
/** "Almost full" pile: this many pieces or fewer short of a bag. */
export const NEAR_FULL = 100;

/** Uncounted bags, oldest first -- the order the count list works in. */
export function uncountedOldestFirst(collections: CollectionBag[], companyId: string | "all" = "all") {
  return collections
    .filter((c) => c.status === "uncounted" && (companyId === "all" || c.companyId === companyId))
    .sort((a, b) => a.collectedDate.localeCompare(b.collectedDate) || a.bagNumber.localeCompare(b.bagNumber));
}

export function staleUncounted(collections: CollectionBag[]) {
  return collections.filter((c) => c.status === "uncounted" && daysSince(c.collectedDate) >= STALE_COUNT_DAYS);
}

/** Loose counted pieces of one company, one pile per MRP, ₹ low to high. */
export function pilesOf(countLines: CountLine[], companyId: string): MrpTier[] {
  return buildMrpTiers(countLines.filter((l) => !l.packed && l.companyId === companyId));
}

export function allPiles(countLines: CountLine[]): MrpTier[] {
  return buildMrpTiers(countLines.filter((l) => !l.packed));
}

/** Full bags waiting to be tied, across every pile in scope. */
export function fullBagsWaiting(countLines: CountLine[], companyId: string | "all" = "all") {
  return allPiles(countLines)
    .filter((t) => companyId === "all" || t.companyId === companyId)
    .reduce((sum, t) => sum + t.fullBags, 0);
}

export function readyBags(sortedBags: SortedBag[], companyId: string | "all" = "all") {
  return sortedBags.filter((b) => b.status === "ready" && (companyId === "all" || b.companyId === companyId));
}

export function bagValue(bag: SortedBag) {
  return bag.pieceCount * bag.mrp;
}

export function sumValue(bags: SortedBag[]) {
  return bags.reduce((sum, b) => sum + bagValue(b), 0);
}

/** One row per MRP: full bags and the part-filled ones listed apart. */
export function mrpBreakdown(bags: SortedBag[]) {
  const rows = new Map<string, { mrp: number; full: boolean; bags: number; pieces: number; value: number }>();
  bags.forEach((b) => {
    const key = `${b.mrp}:${b.isFull ? "f" : "p"}`;
    const row = rows.get(key) ?? { mrp: b.mrp, full: b.isFull, bags: 0, pieces: 0, value: 0 };
    row.bags += 1;
    row.pieces += b.pieceCount;
    row.value += bagValue(b);
    rows.set(key, row);
  });
  return Array.from(rows.values()).sort((a, b) => b.value - a.value);
}

/** Still with the factory: sent and not yet paid. */
export function isAwaitingPayment(d: Dispatch) {
  return d.status === "sent" || d.status === "under_review";
}

export function awaitingPayment(dispatches: Dispatch[], companyId: string | "all" = "all") {
  return dispatches.filter((d) => isAwaitingPayment(d) && (companyId === "all" || d.companyId === companyId));
}

/** What the factory cut from a claim it has answered. */
export function shortfall(d: Dispatch) {
  if (isAwaitingPayment(d)) return 0;
  return Math.max(0, d.claimedValue - (d.receivedValue ?? 0));
}

export function monthStart(date = today()) {
  return `${date.slice(0, 7)}-01`;
}

export function quarterStart(date = today()) {
  const month = Number(date.slice(5, 7));
  const first = month - ((month - 1) % 3);
  return `${date.slice(0, 4)}-${String(first).padStart(2, "0")}-01`;
}

/** Average value of one counted piece, to estimate uncounted bags. */
export function pieceEstimates(countLines: CountLine[], collections: CollectionBag[]) {
  const pieces = countLines.reduce((s, l) => s + l.quantity, 0);
  const value = countLines.reduce((s, l) => s + l.quantity * l.mrp, 0);
  const counted = collections.filter((c) => c.status !== "uncounted").length;
  return {
    valuePerPiece: pieces ? value / pieces : 10,
    piecesPerBag: counted ? pieces / counted : 500,
  };
}

/** Rough ₹ value of bags nobody has counted yet. */
export function uncountedEstimate(uncounted: CollectionBag[], countLines: CountLine[], collections: CollectionBag[]) {
  const { valuePerPiece, piecesPerBag } = pieceEstimates(countLines, collections);
  return uncounted.reduce((sum, c) => sum + (c.estimatedPieces ?? piecesPerBag) * valuePerPiece, 0);
}

/** Bags brought in vs bags counted, per week, for the last `weeks` weeks. */
export function weeklyFlow(collections: CollectionBag[], weeks = 8) {
  const end = today();
  return Array.from({ length: weeks }, (_, i) => {
    const to = addDays(end, -7 * (weeks - 1 - i));
    const from = addDays(to, -6);
    const inRange = (d?: string) => !!d && d >= from && d <= to;
    return {
      label: to,
      came: collections.filter((c) => inRange(c.collectedDate)).length,
      counted: collections.filter((c) => inRange(c.countedDate)).length,
    };
  });
}

export function averageDaysToPay(dispatches: Dispatch[], from: string, to = today()) {
  const paid = dispatches.filter((d) => d.settledDate && d.status !== "rejected" && d.settledDate >= from && d.settledDate <= to);
  if (paid.length === 0) return null;
  return Math.round(paid.reduce((s, d) => s + daysBetween(d.sentDate, d.settledDate!), 0) / paid.length);
}

export { BAG_CAPACITY };
