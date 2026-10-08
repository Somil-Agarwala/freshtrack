import { lineValue } from "./claim";
import type { BagContent, BagItem, Company, CountLine, SortedBag } from "@/types";

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

function codeFor(companies: Company[], companyId: string): string {
  return companies.find((c) => c.id === companyId)?.code ?? "GEN";
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

export { bagValue as sortedBagValue } from "./claim";

/** The next bag number for a company and MRP, e.g. HLD-M10-2026-0008. */
export function issueBagNumber(companies: Company[], companyId: string, mrp: number, dateStr: string, sequence: SequenceState): string {
  const year = new Date(dateStr).getFullYear();
  const [seq] = takeSequence(sequence, companyId, "BAG", year, 1);
  return `${codeFor(companies, companyId)}-M${mrp}-${year}-${String(seq).padStart(4, "0")}`;
}

/** Open bags of one company + MRP, oldest number first: the order they are filled. */
function openFor(bags: SortedBag[], companyId: string, mrp: number): SortedBag[] {
  return bags
    .filter((b) => b.status === "open" && b.companyId === companyId && b.mrp === mrp && b.pieceCount < BAG_CAPACITY)
    .sort((a, b) => a.bagNumber.localeCompare(b.bagNumber));
}

/**
 * Puts freshly counted pieces straight into numbered bags, the moment the
 * count is saved, so the counter can be told "these items go in this bag".
 *
 * Each company + MRP has an open bag being filled. Pieces top up the oldest
 * open bag first; when a bag reaches BAG_CAPACITY it is full (ready for the
 * factory) and the next pieces go into a newly numbered bag. A counted line
 * that does not fit is split across bags, so every piece belongs to exactly
 * one bag and each bag knows its items.
 *
 * Returns the placed lines (each with its bagId) and the whole bag list.
 * Piece counts are updated here; items, parties and value are filled in by
 * refreshBags, which works them out from the lines.
 */
export function putIntoBags(
  lines: CountLine[],
  bags: SortedBag[],
  companies: Company[],
  dateStr: string,
  sequence: SequenceState,
  openedFor: string
): { lines: CountLine[]; bags: SortedBag[] } {
  const next = bags.map((b) => ({ ...b }));
  const placed: CountLine[] = [];

  lines.forEach((line) => {
    let left = line.quantity;
    let part = 0;
    while (left > 0) {
      let bag = openFor(next, line.companyId, line.mrp)[0];
      if (!bag) {
        const bagNumber = issueBagNumber(companies, line.companyId, line.mrp, dateStr, sequence);
        bag = {
          id: `sb-${bagNumber}`,
          bagNumber,
          companyId: line.companyId,
          mrp: line.mrp,
          pieceCount: 0,
          isFull: false,
          createdDate: dateStr,
          status: "open",
          sourceCollectionIds: [],
          openedFor,
        };
        next.push(bag);
      }
      const take = Math.min(left, BAG_CAPACITY - bag.pieceCount);
      placed.push({ ...line, id: part === 0 && take === line.quantity ? line.id : `${line.id}-${part}`, quantity: take, bagId: bag.id, packed: true });
      bag.pieceCount += take;
      if (bag.pieceCount >= BAG_CAPACITY) {
        bag.status = "ready";
        bag.isFull = true;
      }
      left -= take;
      part += 1;
    }
  });

  return { lines: placed, bags: next };
}

/**
 * Works out each bag's pieces, items, parties and claim value from the
 * counted lines inside it. Run after any change to the lines.
 *
 * - A full open bag becomes ready; a full bag that lost pieces (its pickup
 *   was re-counted or deleted) opens again to be topped up, unless it was
 *   closed part-filled on purpose before a factory run.
 * - Bags already sent to the factory are never touched.
 * - With `dropEmpty`, open bags left with no pieces are removed. Their
 *   numbers are not reused.
 */
export function refreshBags(bags: SortedBag[], lines: CountLine[], dropEmpty = true): SortedBag[] {
  const byBag = new Map<string, CountLine[]>();
  lines.forEach((l) => {
    if (!l.bagId) return;
    byBag.set(l.bagId, [...(byBag.get(l.bagId) ?? []), l]);
  });

  return bags.flatMap((bag) => {
    if (bag.status === "dispatched") return [bag];
    const inside = byBag.get(bag.id) ?? [];
    const pieceCount = inside.reduce((s, l) => s + l.quantity, 0);
    if (pieceCount === 0 && dropEmpty) return [];

    const byProduct = new Map<string, number>();
    const byCollection = new Map<string, { pieces: number; value: number }>();
    inside.forEach((l) => {
      byProduct.set(l.productId, (byProduct.get(l.productId) ?? 0) + l.quantity);
      const c = byCollection.get(l.collectionId) ?? { pieces: 0, value: 0 };
      byCollection.set(l.collectionId, { pieces: c.pieces + l.quantity, value: c.value + lineValue(l) });
    });
    const items: BagItem[] = Array.from(byProduct, ([productId, pieces]) => ({ productId, pieces })).sort((a, b) => b.pieces - a.pieces);
    const contents: BagContent[] = Array.from(byCollection, ([collectionId, c]) => ({ collectionId, pieces: c.pieces, value: Math.round(c.value * 100) / 100 }));
    const isFull = pieceCount >= BAG_CAPACITY;

    let status = bag.status;
    if (status === "open" && isFull) status = "ready";
    if (status === "ready" && !isFull && !bag.closedEarly) status = "open";

    return [
      {
        ...bag,
        status,
        pieceCount,
        isFull,
        items,
        contents,
        sourceCollectionIds: contents.map((c) => c.collectionId),
        claimValue: Math.round(contents.reduce((s, c) => s + (c.value ?? 0), 0) * 100) / 100,
      },
    ];
  });
}
