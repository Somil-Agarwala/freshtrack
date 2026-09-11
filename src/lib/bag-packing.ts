import type { CountLine, SortedBag } from "@/types";

/** Pieces per sorted bag. Change here and every projection follows. */
export const BAG_CAPACITY = 700;

export interface MrpTier {
  mrp: number;
  pieces: number;
  /** Bags this tier will produce: full bags plus one part-filled remainder. */
  fullBags: number;
  remainder: number;
  totalBags: number;
  value: number;
  sourceCollectionIds: string[];
}

/**
 * Groups unpacked count lines into MRP tiers. Pieces are pooled ACROSS
 * collection bags on purpose: bags are filled by printed price, not by
 * SKU and not by party, so pooling is what actually fills a bag to 700
 * instead of leaving a part-filled bag per party per tier.
 * Traceability is preserved via sourceCollectionIds.
 */
export function buildMrpTiers(lines: CountLine[]): MrpTier[] {
  const byMrp = new Map<number, { pieces: number; collections: Set<string> }>();

  lines
    .filter((line) => !line.packed)
    .forEach((line) => {
      const entry = byMrp.get(line.mrp) ?? { pieces: 0, collections: new Set<string>() };
      entry.pieces += line.quantity;
      entry.collections.add(line.collectionId);
      byMrp.set(line.mrp, entry);
    });

  return Array.from(byMrp.entries())
    .map(([mrp, entry]) => {
      const fullBags = Math.floor(entry.pieces / BAG_CAPACITY);
      const remainder = entry.pieces % BAG_CAPACITY;
      return {
        mrp,
        pieces: entry.pieces,
        fullBags,
        remainder,
        totalBags: fullBags + (remainder > 0 ? 1 : 0),
        value: entry.pieces * mrp,
        sourceCollectionIds: Array.from(entry.collections),
      };
    })
    .sort((a, b) => a.mrp - b.mrp);
}

/**
 * Turns MRP tiers into concrete SortedBag rows. Bag numbers encode the
 * MRP tier (M10-2026-0007) so that someone holding the physical bag can
 * read its price tier off the label without a lookup.
 */
export function packTiersIntoBags(tiers: MrpTier[], existingBagCount: number, dateStr: string): SortedBag[] {
  const year = new Date(dateStr).getFullYear();
  const bags: SortedBag[] = [];
  let sequence = existingBagCount + 1;

  tiers.forEach((tier) => {
    let remaining = tier.pieces;
    while (remaining > 0) {
      const pieceCount = Math.min(BAG_CAPACITY, remaining);
      bags.push({
        id: `sb-${year}-${sequence}`,
        bagNumber: `M${tier.mrp}-${year}-${String(sequence).padStart(4, "0")}`,
        mrp: tier.mrp,
        pieceCount,
        isFull: pieceCount === BAG_CAPACITY,
        createdDate: dateStr,
        status: "ready",
        sourceCollectionIds: tier.sourceCollectionIds,
      });
      remaining -= pieceCount;
      sequence += 1;
    }
  });

  return bags;
}

/** Sequential collection-bag number, e.g. COL-2026-0042. */
export function nextCollectionNumber(existingCount: number, dateStr: string): string {
  const year = new Date(dateStr).getFullYear();
  return `COL-${year}-${String(existingCount + 1).padStart(4, "0")}`;
}

/** Sequential dispatch number, e.g. DSP-2026-0007. */
export function nextDispatchNumber(existingCount: number, dateStr: string): string {
  const year = new Date(dateStr).getFullYear();
  return `DSP-${year}-${String(existingCount + 1).padStart(4, "0")}`;
}

export function sortedBagValue(bag: SortedBag): number {
  return bag.pieceCount * bag.mrp;
}
