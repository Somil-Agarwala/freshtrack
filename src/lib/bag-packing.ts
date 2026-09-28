import type { BagContent, CollectionBag, Company, CountLine, SortedBag } from "@/types";
import { newId, yearOf } from "./utils";

/** Pieces per sorted bag. Change here and every projection follows. */
export const BAG_CAPACITY = 700;

/**
 * Last sequence number issued per company, per year.
 *
 * Numbering MUST come from a counter that only ever moves forward -- never
 * from how many records exist, and never from the highest surviving record.
 * Both of those break on deletion: clearing 500 claimed bags would hand a
 * fresh bag a number the factory has already seen against an older claim,
 * so two different physical bags would share one number in factory records.
 *
 * Key format: `<companyId>:<kind>:<year>`.
 *
 * In Supabase this is the `number_counters` table, advanced by the
 * `next_numbers()` function inside the same transaction that creates the rows.
 */
export type SequenceState = Record<string, number>;

export type SequenceKind = "COL" | "BAG" | "DSP";

function seqKey(companyId: string, kind: SequenceKind, year: number): string {
  return `${companyId}:${kind}:${year}`;
}

/** Trailing `-<year>-<seq>` that every number in this file ends with. */
const NUMBER_TAIL = /-(\d{4})-(\d+)$/;

/**
 * Takes the next `count` numbers for a company and advances the counter.
 * Mutates `state` deliberately: the caller persists it, so a number is never
 * handed out twice, even after records are deleted.
 */
export function takeSequence(
  state: SequenceState,
  companyId: string,
  kind: SequenceKind,
  year: number,
  count = 1
): number[] {
  const key = seqKey(companyId, kind, year);
  const start = state[key] ?? 0;
  const issued = Array.from({ length: count }, (_, i) => start + 1 + i);
  state[key] = start + count;
  return issued;
}

/**
 * Seeds the counter from numbers that already exist, so pre-existing records
 * (seed data, or rows loaded from the database) are never re-issued.
 */
export function seedSequence(
  state: SequenceState,
  companyId: string,
  kind: SequenceKind,
  year: number,
  existingNumbers: string[]
): void {
  const key = seqKey(companyId, kind, year);
  const highest = existingNumbers.reduce((max, value) => {
    const match = value.match(NUMBER_TAIL);
    if (!match || Number(match[1]) !== year) return max;
    return Math.max(max, Number(match[2]));
  }, 0);
  state[key] = Math.max(state[key] ?? 0, highest);
}

/** Pieces of a count line not yet inside any sorted bag. */
export function pendingQuantity(line: CountLine): number {
  return Math.max(0, line.quantity - line.packedQuantity);
}

/** The collection bags that contributed pieces to a sorted bag. */
export function bagCollectionIds(bag: SortedBag): string[] {
  return Array.from(new Set(bag.contents.map((c) => c.collectionId)));
}

export interface MrpTier {
  companyId: string;
  mrp: number;
  pieces: number;
  /** Bags this tier will produce: full bags plus one part-filled remainder. */
  fullBags: number;
  remainder: number;
  totalBags: number;
  value: number;
  sourceCollectionIds: string[];
}

function tierKey(companyId: string, mrp: number): string {
  return `${companyId}::${mrp}`;
}

/**
 * Groups pending pieces into COMPANY + MRP tiers.
 *
 * Company is the hard boundary: each company settles its own claim at its own
 * factory, so pieces never pool across companies however well the MRP matches.
 * Within one company, pieces DO pool across parties, because that is what
 * fills a bag to capacity instead of leaving a part-filled bag per party.
 */
export function buildMrpTiers(lines: CountLine[]): MrpTier[] {
  const tiers = new Map<string, { companyId: string; mrp: number; pieces: number; collections: Set<string> }>();

  lines.forEach((line) => {
    const pending = pendingQuantity(line);
    if (pending <= 0) return;
    const key = tierKey(line.companyId, line.mrp);
    const entry = tiers.get(key) ?? { companyId: line.companyId, mrp: line.mrp, pieces: 0, collections: new Set<string>() };
    entry.pieces += pending;
    entry.collections.add(line.collectionId);
    tiers.set(key, entry);
  });

  return Array.from(tiers.values())
    .map((entry) => {
      const fullBags = Math.floor(entry.pieces / BAG_CAPACITY);
      const remainder = entry.pieces % BAG_CAPACITY;
      return {
        companyId: entry.companyId,
        mrp: entry.mrp,
        pieces: entry.pieces,
        fullBags,
        remainder,
        totalBags: fullBags + (remainder > 0 ? 1 : 0),
        value: entry.pieces * entry.mrp,
        sourceCollectionIds: Array.from(entry.collections),
      };
    })
    .sort((a, b) => a.companyId.localeCompare(b.companyId) || a.mrp - b.mrp);
}

function codeFor(companies: Company[], companyId: string): string {
  return companies.find((c) => c.id === companyId)?.code ?? "GEN";
}

export interface PackOptions {
  /**
   * Only make bags that come out at exactly BAG_CAPACITY. The leftover stays
   * waiting and tops up the next run instead of going out as a part-filled
   * bag. Off by default: then the last bag in each tier is part-filled.
   */
  fullBagsOnly?: boolean;
}

export interface PackPlan {
  bags: SortedBag[];
  /** Pieces taken from each count line, keyed by line id. */
  taken: Map<string, number>;
}

/**
 * THE PACKING ALGORITHM.
 *
 *   1. Take every count line with pending pieces (quantity - packedQuantity).
 *   2. Group by company + MRP. Nothing crosses either boundary.
 *   3. Inside a group, order oldest first: collection date, then collection
 *      bag number, then line. Older stock is claimed first, and the same
 *      input always produces the same bags.
 *   4. Work out how many bags: ceil(pieces / 700), or floor(...) when only
 *      full bags are wanted.
 *   5. Reserve that many bag numbers in one go from the forward-only counter.
 *   6. Walk the ordered lines, pouring pieces into the current bag until it
 *      holds 700, then start the next. A line that does not fit is split:
 *      part goes into this bag, the rest into the next one.
 *   7. Every pour is recorded as a BagContent entry, so each bag knows exactly
 *      which collection bag and SKU its pieces came from -- and in what number.
 *
 * Pure apart from advancing `sequence`, which the caller persists.
 */
export function planPacking(
  lines: CountLine[],
  collections: CollectionBag[],
  companies: Company[],
  dateStr: string,
  sequence: SequenceState,
  options: PackOptions = {}
): PackPlan {
  const year = yearOf(dateStr);
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const lineOrder = new Map(lines.map((l, index) => [l.id, index]));

  const groups = new Map<string, { companyId: string; mrp: number; lines: CountLine[] }>();
  lines.forEach((line) => {
    if (pendingQuantity(line) <= 0) return;
    const key = tierKey(line.companyId, line.mrp);
    const group = groups.get(key) ?? { companyId: line.companyId, mrp: line.mrp, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  });

  const oldestFirst = (a: CountLine, b: CountLine) => {
    const ca = collectionById.get(a.collectionId);
    const cb = collectionById.get(b.collectionId);
    return (
      (ca?.collectedDate ?? "").localeCompare(cb?.collectedDate ?? "") ||
      (ca?.bagNumber ?? "").localeCompare(cb?.bagNumber ?? "") ||
      (lineOrder.get(a.id) ?? 0) - (lineOrder.get(b.id) ?? 0)
    );
  };

  const bags: SortedBag[] = [];
  const taken = new Map<string, number>();

  Array.from(groups.values())
    .sort((a, b) => a.companyId.localeCompare(b.companyId) || a.mrp - b.mrp)
    .forEach((group) => {
      const ordered = group.lines.slice().sort(oldestFirst);
      const pieces = ordered.reduce((sum, l) => sum + pendingQuantity(l), 0);
      const bagsNeeded = options.fullBagsOnly ? Math.floor(pieces / BAG_CAPACITY) : Math.ceil(pieces / BAG_CAPACITY);
      if (bagsNeeded === 0) return;

      const code = codeFor(companies, group.companyId);
      // Every number this tier needs is reserved at once, so nothing else
      // can be issued in between and produce a duplicate.
      const seqs = takeSequence(sequence, group.companyId, "BAG", year, bagsNeeded);
      let toPack = options.fullBagsOnly ? bagsNeeded * BAG_CAPACITY : pieces;

      let lineIndex = 0;
      let leftInLine = pendingQuantity(ordered[0]);

      seqs.forEach((seq) => {
        const target = Math.min(BAG_CAPACITY, toPack);
        const contents: BagContent[] = [];
        let filled = 0;

        while (filled < target) {
          const line = ordered[lineIndex];
          const pour = Math.min(leftInLine, target - filled);
          contents.push({ countLineId: line.id, collectionId: line.collectionId, productId: line.productId, quantity: pour });
          taken.set(line.id, (taken.get(line.id) ?? 0) + pour);
          filled += pour;
          leftInLine -= pour;
          if (leftInLine === 0 && lineIndex + 1 < ordered.length) {
            lineIndex += 1;
            leftInLine = pendingQuantity(ordered[lineIndex]);
          }
        }

        toPack -= filled;
        bags.push({
          id: newId(),
          bagNumber: `${code}-M${group.mrp}-${year}-${String(seq).padStart(4, "0")}`,
          companyId: group.companyId,
          mrp: group.mrp,
          pieceCount: filled,
          isFull: filled === BAG_CAPACITY,
          createdDate: dateStr,
          status: "ready",
          contents,
        });
      });
    });

  return { bags, taken };
}

/**
 * Issues `count` collection numbers for a company, e.g. CAD-COL-2026-0042,
 * advancing the counter so none can be handed out twice.
 */
export function issueCollectionNumbers(
  companyCode: string,
  companyId: string,
  dateStr: string,
  sequence: SequenceState,
  count = 1
): string[] {
  const year = yearOf(dateStr);
  return takeSequence(sequence, companyId, "COL", year, count).map(
    (seq) => `${companyCode}-COL-${year}-${String(seq).padStart(4, "0")}`
  );
}

/** Issues one dispatch number, e.g. CAD-DSP-2026-0007. */
export function issueDispatchNumber(
  companyCode: string,
  companyId: string,
  dateStr: string,
  sequence: SequenceState
): string {
  const year = yearOf(dateStr);
  const [seq] = takeSequence(sequence, companyId, "DSP", year, 1);
  return `${companyCode}-DSP-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Preview only: what the next `count` numbers WOULD be, without advancing the
 * counter. The dialog uses this so its preview matches what creation mints.
 */
export function peekCollectionNumbers(
  companyCode: string,
  companyId: string,
  dateStr: string,
  sequence: SequenceState,
  count = 1
): string[] {
  return issueCollectionNumbers(companyCode, companyId, dateStr, { ...sequence }, count);
}

export function sortedBagValue(bag: SortedBag): number {
  return bag.pieceCount * bag.mrp;
}
