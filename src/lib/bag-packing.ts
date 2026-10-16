import { lineValue } from "./claim";
import type { BagContent, BagItem, Company, CountLine, SortedBag } from "@/types";


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

/**
 * Works out each bag's pieces, items, parties and claim value from the
 * counted lines inside it. Run after any change to the lines.
 *
 * Pieces get into a bag only when staff put them in and say how many
 * (fillBag); a bag's status only changes by hand (tie / untie) or by
 * sending it to the factory.
 *
 * - Bags already sent to the factory are never touched.
 * - An open bag stays even when empty (its number may be written on it); a
 *   tied bag left with nothing in it is removed. Numbers are never reused.
 */
export function refreshBags(bags: SortedBag[], lines: CountLine[]): SortedBag[] {
  const byBag = new Map<string, CountLine[]>();
  lines.forEach((l) => {
    if (!l.bagId) return;
    byBag.set(l.bagId, [...(byBag.get(l.bagId) ?? []), l]);
  });

  return bags.flatMap((bag) => {
    if (bag.status === "dispatched") return [bag];
    const inside = byBag.get(bag.id) ?? [];
    const pieceCount = inside.reduce((s, l) => s + l.quantity, 0);
    if (pieceCount === 0 && bag.status !== "open") return [];

    const byProduct = new Map<string, number>();
    const byCollection = new Map<string, { pieces: number; value: number }>();
    const own = { pieces: 0, value: 0 };
    inside.forEach((l) => {
      byProduct.set(l.productId, (byProduct.get(l.productId) ?? 0) + l.quantity);
      // Own-godown damage has no party, so it is kept out of the party split.
      if (l.recordId) {
        own.pieces += l.quantity;
        own.value += lineValue(l);
        return;
      }
      const c = byCollection.get(l.collectionId) ?? { pieces: 0, value: 0 };
      byCollection.set(l.collectionId, { pieces: c.pieces + l.quantity, value: c.value + lineValue(l) });
    });
    const items: BagItem[] = Array.from(byProduct, ([productId, pieces]) => ({ productId, pieces })).sort((a, b) => b.pieces - a.pieces);
    const contents: BagContent[] = Array.from(byCollection, ([collectionId, c]) => ({ collectionId, pieces: c.pieces, value: Math.round(c.value * 100) / 100 }));

    return [
      {
        ...bag,
        pieceCount,
        isFull: bag.status !== "open",
        items,
        contents,
        sourceCollectionIds: contents.map((c) => c.collectionId),
        own: own.pieces ? { pieces: own.pieces, value: Math.round(own.value * 100) / 100 } : undefined,
        claimValue: Math.round((contents.reduce((s, c) => s + (c.value ?? 0), 0) + own.value) * 100) / 100,
      },
    ];
  });
}
