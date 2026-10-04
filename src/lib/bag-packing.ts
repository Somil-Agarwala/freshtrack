import type { BagContent, Company, CountLine, SortedBag } from "@/types";

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
 * When Supabase is wired up this becomes a counter table (or one Postgres
 * sequence per company), so it survives a full wipe of the record tables.
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

/**
 * Groups unpacked count lines into COMPANY + MRP tiers.
 *
 * Company is the hard boundary: each company settles its own claim at its own
 * factory, so pieces never pool across companies however well the MRP matches.
 * Within one company, pieces DO pool across parties, because that is what
 * fills a bag to capacity instead of leaving a part-filled bag per party.
 * Traceability survives through sourceCollectionIds.
 */
export function buildMrpTiers(lines: CountLine[]): MrpTier[] {
  const tiers = new Map<string, { companyId: string; mrp: number; pieces: number; collections: Set<string> }>();

  lines
    .filter((line) => !line.packed)
    .forEach((line) => {
      const key = `${line.companyId}::${line.mrp}`;
      const entry = tiers.get(key) ?? { companyId: line.companyId, mrp: line.mrp, pieces: 0, collections: new Set<string>() };
      entry.pieces += line.quantity;
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

/**
 * Turns tiers into concrete SortedBag rows. Bag numbers lead with the company
 * code and carry the MRP tier (CAD-M10-2026-0008), so someone holding the
 * physical bag reads both off the label without a lookup.
 */
export function packTiersIntoBags(
  tiers: MrpTier[],
  companies: Company[],
  dateStr: string,
  sequence: SequenceState
): SortedBag[] {
  const year = new Date(dateStr).getFullYear();
  const bags: SortedBag[] = [];

  tiers.forEach((tier) => {
    const code = codeFor(companies, tier.companyId);
    // Take every number this tier needs in one go, so a concurrent tier
    // cannot interleave and produce a duplicate.
    const bagsNeeded = Math.ceil(tier.pieces / BAG_CAPACITY);
    const seqs = takeSequence(sequence, tier.companyId, "BAG", year, bagsNeeded);

    let remaining = tier.pieces;
    let index = 0;
    while (remaining > 0) {
      const pieceCount = Math.min(BAG_CAPACITY, remaining);
      const seq = seqs[index];
      index += 1;

      bags.push({
        id: `sb-${tier.companyId}-${year}-${seq}`,
        bagNumber: `${code}-M${tier.mrp}-${year}-${String(seq).padStart(4, "0")}`,
        companyId: tier.companyId,
        mrp: tier.mrp,
        pieceCount,
        isFull: pieceCount === BAG_CAPACITY,
        createdDate: dateStr,
        status: "ready",
        sourceCollectionIds: tier.sourceCollectionIds,
      });
      remaining -= pieceCount;
    }
  });

  return bags;
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
  const year = new Date(dateStr).getFullYear();
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
  const year = new Date(dateStr).getFullYear();
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

/**
 * Records which pickups each new bag's pieces came from. Bags of one
 * company + MRP are filled in the order they were created, from `lines`
 * oldest pickup first -- the same order the pieces were taken from the
 * pile. `collectedOn` maps a collection id to its pickup date.
 */
export function fillBagContents(bags: SortedBag[], lines: CountLine[], collectedOn: Map<string, string>): SortedBag[] {
  const queues = new Map<string, { collectionId: string; left: number }[]>();
  lines
    .slice()
    .sort((a, b) => (collectedOn.get(a.collectionId) ?? "").localeCompare(collectedOn.get(b.collectionId) ?? "") || a.id.localeCompare(b.id))
    .forEach((line) => {
      const key = `${line.companyId}::${line.mrp}`;
      const queue = queues.get(key) ?? [];
      queue.push({ collectionId: line.collectionId, left: line.quantity });
      queues.set(key, queue);
    });

  return bags.map((bag) => {
    const queue = queues.get(`${bag.companyId}::${bag.mrp}`) ?? [];
    const byCollection = new Map<string, number>();
    let need = bag.pieceCount;
    while (need > 0 && queue.length > 0) {
      const head = queue[0];
      const take = Math.min(need, head.left);
      byCollection.set(head.collectionId, (byCollection.get(head.collectionId) ?? 0) + take);
      head.left -= take;
      need -= take;
      if (head.left === 0) queue.shift();
    }
    const contents: BagContent[] = Array.from(byCollection, ([collectionId, pieces]) => ({ collectionId, pieces }));
    return contents.length ? { ...bag, contents, sourceCollectionIds: contents.map((c) => c.collectionId) } : bag;
  });
}
