import { issueCollectionNumbers, issueDispatchNumber, putIntoBags, refreshBags } from "../bag-packing";
import { bagValue } from "../claim";
import { partySharesForBags } from "../pipeline";
import type { CollectionBag, Company, CountLine, DamageRecord, Dispatch, Distributor, Product, SortedBag, UserAccount } from "@/types";
import * as seed from "../seed-data";
import type { AppData } from "./app-data";

/**
 * Every change the app can make, as a pure function: (data, env, ...args)
 * → [new data, result]. Nothing here reads the clock, makes random ids or
 * mutates its input -- the time stamp, date and user come in `env`. That
 * is what lets the sync engine redo a change on top of what another phone
 * saved first and get the same records, with the same ids.
 */
export interface OpEnv {
  /** Unique and time-ordered; record ids are built from it. */
  stamp: string;
  /** The day the change was made, YYYY-MM-DD. */
  today: string;
  /** Signed-in user id, stamped on what they did. */
  actor?: string;
}

export interface CollectionInput {
  companyId: string;
  distributorId: string;
  collectedDate: string;
  estimatedPieces?: number;
  notes?: string;
  photoUrl?: string;
}

export type CountInput = { productId: string; mrp: number; quantity: number }[];

type Result<R> = [AppData, R];

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  return rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
}

const sentIds = (bags: SortedBag[]) => new Set(bags.filter((b) => b.status === "dispatched").map((b) => b.id));

/** A bag tied by hand: full, closed, ready for the factory. */
const tied = (b: SortedBag, env: OpEnv): SortedBag => ({ ...b, status: "ready", isFull: true, tiedBy: env.actor, tiedDate: env.today });

export const OPS = {
  /** The built-in companies, products, parties and users, once, into an empty database. */
  seed(d: AppData): Result<boolean> {
    if (d.companies.length || d.products.length || d.users.length) return [d, false];
    return [{ ...d, companies: seed.companies, distributors: seed.distributors, products: seed.products, users: seed.users }, true];
  },

  saveCompany: (d: AppData, _env: OpEnv, company: Company): Result<void> => [{ ...d, companies: upsert(d.companies, company) }, undefined],
  saveProduct: (d: AppData, _env: OpEnv, product: Product): Result<void> => [{ ...d, products: upsert(d.products, product) }, undefined],
  saveDistributor: (d: AppData, _env: OpEnv, distributor: Distributor): Result<void> => [{ ...d, distributors: upsert(d.distributors, distributor) }, undefined],
  saveUser: (d: AppData, _env: OpEnv, user: UserAccount): Result<void> => [{ ...d, users: upsert(d.users, user) }, undefined],

  updateRecord(d: AppData, _env: OpEnv, id: string, patch: Partial<Omit<DamageRecord, "id">>): Result<void> {
    return [{ ...d, records: d.records.map((r) => (r.id === id ? { ...r, ...patch } : r)) }, undefined];
  },

  addProduct(d: AppData, env: OpEnv, product: Omit<Product, "id">): Result<Product> {
    const created: Product = { ...product, id: `p-${env.stamp}` };
    return [{ ...d, products: [...d.products, created] }, created];
  },

  addDistributor(d: AppData, env: OpEnv, distributor: Omit<Distributor, "id" | "isActive">): Result<Distributor> {
    const created: Distributor = { ...distributor, id: `d-${env.stamp}`, isActive: true };
    return [{ ...d, distributors: [...d.distributors, created] }, created];
  },

  addCollections(d: AppData, env: OpEnv, input: CollectionInput, bagCount: number): Result<CollectionBag[]> {
    // One pickup usually means several bags from the same party, numbered in
    // one pass from the company's forward-only counter.
    const safeCount = Math.max(1, Math.floor(bagCount));
    const code = d.companies.find((c) => c.id === input.companyId)?.code ?? "GEN";
    const seq = { ...d.seq };
    const numbers = issueCollectionNumbers(code, input.companyId, input.collectedDate, seq, safeCount);
    const created: CollectionBag[] = Array.from({ length: safeCount }, (_, index) => ({
      id: `c-${env.stamp}-${String(index).padStart(3, "0")}`,
      bagNumber: numbers[index],
      companyId: input.companyId,
      distributorId: input.distributorId,
      collectedDate: input.collectedDate,
      status: "uncounted",
      estimatedPieces: input.estimatedPieces,
      notes: input.notes,
      // One photo shows the whole pickup; it is kept on the first bag only
      // and the others show it from there.
      photoUrl: index === 0 ? input.photoUrl : undefined,
      loggedBy: env.actor,
    }));
    return [{ ...d, seq, collections: [...created, ...d.collections] }, created];
  },

  /**
   * Goods a party sent that are already counted: one pickup record, marked
   * as a direct entry, with its count saved at once -- so the pieces go
   * straight into the numbered bags, like a normal count.
   */
  addCountedPickup(d: AppData, env: OpEnv, input: CollectionInput, lines: CountInput): Result<CollectionBag | null> {
    if (!lines.some((l) => l.quantity > 0)) return [d, null];
    const [withPickup, created] = OPS.addCollections(d, env, input, 1);
    const id = created[0].id;
    const marked = { ...withPickup, collections: withPickup.collections.map((c) => (c.id === id ? { ...c, direct: true } : c)) };
    const [counted] = OPS.saveCount(marked, env, id, lines);
    return [counted, counted.collections.find((c) => c.id === id) ?? null];
  },

  deleteCollections(d: AppData, _env: OpEnv, ids: string[]): Result<void> {
    // Goods already sent to the factory cannot be taken back out of a claim.
    const sent = sentIds(d.sortedBags);
    const allowed = new Set(ids.filter((id) => !d.countLines.some((l) => l.collectionId === id && l.bagId && sent.has(l.bagId))));
    if (allowed.size === 0) return [d, undefined];
    const rest = d.countLines.filter((l) => !allowed.has(l.collectionId));
    return [
      {
        ...d,
        collections: d.collections.filter((c) => !allowed.has(c.id)),
        countLines: rest,
        // Their pieces come out of the bags they were put in.
        sortedBags: refreshBags(d.sortedBags, rest),
      },
      undefined,
    ];
  },

  saveCount(d: AppData, env: OpEnv, collectionId: string, lines: CountInput): Result<boolean> {
    const pickup = d.collections.find((c) => c.id === collectionId);
    if (!pickup) return [d, false];
    const companyId = pickup.companyId;
    const sent = sentIds(d.sortedBags);
    // A count whose goods have gone to the factory is final.
    if (d.countLines.some((l) => l.collectionId === collectionId && l.bagId && sent.has(l.bagId))) return [d, false];

    const fresh: CountLine[] = lines
      .filter((line) => line.quantity > 0)
      .map((line, index) => ({
        id: `cl-${env.stamp}-${index}`,
        collectionId,
        companyId,
        productId: line.productId,
        mrp: line.mrp,
        quantity: line.quantity,
        // The claim rate is fixed at count time, like the MRP.
        rate: d.products.find((p) => p.id === line.productId)?.claimRate,
        packed: false,
      }));

    // A re-count first takes the old pieces back out of their bags. Bags
    // left empty are kept for a moment, and each MRP goes back into the bag
    // it was in (even if tied since): the goods are already in that bag.
    const old = d.countLines.filter((l) => l.collectionId === collectionId && l.bagId);
    const preferred = new Map(old.map((l) => [`${l.companyId}:${l.mrp}`, l.bagId!]));
    const rest = d.countLines.filter((l) => l.collectionId !== collectionId);
    const emptied = refreshBags(d.sortedBags, rest, false);
    const seq = { ...d.seq };
    const { lines: placed, bags } = putIntoBags(fresh, emptied, d.companies, env.today, seq, collectionId, preferred);
    const allLines = [...rest, ...placed];
    const sortedBags = refreshBags(bags, allLines);

    return [
      {
        ...d,
        seq,
        countLines: allLines,
        sortedBags,
        collections: d.collections.map((c) =>
          c.id === collectionId ? { ...c, status: fresh.length ? "packed" : "counted", countedDate: env.today, countedBy: env.actor } : c
        ),
      },
      true,
    ];
  },

  /**
   * A manager ties a bag by hand when it is full -- there is no piece limit,
   * as a full bag holds a different number of pieces for each product. The
   * next goods of that MRP then open a new numbered bag. False if the bag is
   * not open or is empty.
   */
  tieBag(d: AppData, env: OpEnv, bagId: string): Result<boolean> {
    const bag = d.sortedBags.find((b) => b.id === bagId);
    if (!bag || bag.status !== "open" || bag.pieceCount <= 0) return [d, false];
    return [{ ...d, sortedBags: d.sortedBags.map((b) => (b.id === bagId ? tied(b, env) : b)) }, true];
  },

  /**
   * Opens a bag tied by mistake, so it is filled again. Refused (false) once
   * it has gone to the factory, or while another bag of the same MRP is open
   * -- two open bags of one MRP would leave staff unsure which to fill.
   */
  untieBag(d: AppData, _env: OpEnv, bagId: string): Result<boolean> {
    const bag = d.sortedBags.find((b) => b.id === bagId);
    if (!bag || bag.status !== "ready") return [d, false];
    if (d.sortedBags.some((b) => b.status === "open" && b.companyId === bag.companyId && b.mrp === bag.mrp)) return [d, false];
    return [
      { ...d, sortedBags: d.sortedBags.map((b) => (b.id === bagId ? { ...b, status: "open", isFull: false, tiedBy: undefined, tiedDate: undefined, closedEarly: undefined } : b)) },
      true,
    ];
  },

  /** Ties every open bag of a company at once, e.g. before a factory run. Returns the bags tied. */
  closeOpenBags(d: AppData, env: OpEnv, companyId: string): Result<SortedBag[]> {
    const closing = d.sortedBags.filter((b) => b.status === "open" && b.companyId === companyId && b.pieceCount > 0);
    if (closing.length === 0) return [d, []];
    const closed = new Map(closing.map((b) => [b.id, tied(b, env)]));
    return [{ ...d, sortedBags: d.sortedBags.map((b) => closed.get(b.id) ?? b) }, Array.from(closed.values())];
  },

  deleteSortedBags(d: AppData, _env: OpEnv, ids: string[]): Result<void> {
    const idSet = new Set(ids);
    return [{ ...d, sortedBags: d.sortedBags.filter((b) => !idSet.has(b.id)) }, undefined];
  },

  createDispatch(d: AppData, env: OpEnv, bagIds: string[]): Result<Dispatch | null> {
    const idSet = new Set(bagIds);
    const selected = d.sortedBags.filter((b) => idSet.has(b.id) && b.status === "ready");
    if (selected.length === 0) return [d, null];
    // One company's factory per run: a mixed batch could not be claimed.
    const companyId = selected[0].companyId;
    if (selected.some((b) => b.companyId !== companyId)) return [d, null];

    const code = d.companies.find((c) => c.id === companyId)?.code ?? "GEN";
    const seq = { ...d.seq };
    const dispatch: Dispatch = {
      id: `dp-${env.stamp}`,
      dispatchNumber: issueDispatchNumber(code, companyId, env.today, seq),
      companyId,
      sentDate: env.today,
      bagCount: selected.length,
      pieceCount: selected.reduce((sum, b) => sum + b.pieceCount, 0),
      claimedValue: Math.round(selected.reduce((sum, b) => sum + bagValue(b), 0) * 100) / 100,
      status: "sent",
      // Fixed now, so each party's account survives the bags later being cleared.
      partyShares: partySharesForBags(selected, d.collections, d.countLines),
      sentBy: env.actor,
    };
    const going = new Set(selected.map((b) => b.id));
    return [
      {
        ...d,
        seq,
        dispatches: [dispatch, ...d.dispatches],
        sortedBags: d.sortedBags.map((b) => (going.has(b.id) ? { ...b, status: "dispatched", dispatchId: dispatch.id } : b)),
      },
      dispatch,
    ];
  },

  recordSettlement(d: AppData, env: OpEnv, dispatchId: string, receivedValue: number): Result<void> {
    return [
      {
        ...d,
        dispatches: d.dispatches.map((x) =>
          x.id === dispatchId
            ? {
                ...x,
                receivedValue,
                // A short payment stays visible as "partially settled".
                status: receivedValue < x.claimedValue ? "partially_settled" : "settled",
                settledDate: env.today,
                settledBy: env.actor,
              }
            : x
        ),
      },
      undefined,
    ];
  },

  deleteDispatches(d: AppData, _env: OpEnv, ids: string[]): Result<void> {
    const idSet = new Set(ids);
    return [{ ...d, dispatches: d.dispatches.filter((x) => !idSet.has(x.id)) }, undefined];
  },

  addRecord(d: AppData, env: OpEnv, record: Omit<DamageRecord, "id">): Result<DamageRecord> {
    const created: DamageRecord = { ...record, id: `r-${env.stamp}`, loggedBy: env.actor };
    const next: AppData = { ...d, records: [created, ...d.records] };

    // Damage in our own godown is claimed from the factory like any other,
    // so its pieces go into the same numbered bags -- tagged as our own.
    const product = d.products.find((p) => p.id === record.productId);
    if (record.source === "own_inventory" && product && (record.pieces ?? 0) > 0) {
      const line: CountLine = {
        id: `gl-${created.id}`,
        collectionId: `godown:${created.id}`,
        recordId: created.id,
        companyId: record.companyId,
        productId: product.id,
        mrp: product.mrp,
        quantity: record.pieces!,
        rate: product.claimRate,
        packed: false,
      };
      const seq = { ...d.seq };
      const { lines: placed, bags } = putIntoBags([line], d.sortedBags, d.companies, env.today, seq, line.collectionId);
      const allLines = [...d.countLines, ...placed];
      next.seq = seq;
      next.countLines = allLines;
      next.sortedBags = refreshBags(bags, allLines);
    }
    return [next, created];
  },

  deleteRecords(d: AppData, _env: OpEnv, ids: string[]): Result<void> {
    const sent = sentIds(d.sortedBags);
    // Entries whose pieces have gone to the factory stay, like a sent pickup.
    const allowed = new Set(ids.filter((id) => !d.countLines.some((l) => l.recordId === id && l.bagId && sent.has(l.bagId))));
    if (allowed.size === 0) return [d, undefined];
    const rest = d.countLines.filter((l) => !(l.recordId && allowed.has(l.recordId)));
    const next: AppData = { ...d, records: d.records.filter((r) => !allowed.has(r.id)) };
    if (rest.length !== d.countLines.length) {
      next.countLines = rest;
      next.sortedBags = refreshBags(d.sortedBags, rest);
    }
    return [next, undefined];
  },
};

export type OpName = keyof typeof OPS;
type Fn = (d: AppData, env: OpEnv, ...args: unknown[]) => [AppData, unknown];
export type OpArgs<N extends OpName> = (typeof OPS)[N] extends (d: AppData, env: OpEnv, ...args: infer A) => unknown ? A : never;
export type OpResult<N extends OpName> = (typeof OPS)[N] extends (...args: never[]) => [AppData, infer R] ? R : never;

/** A change waiting to be saved: which operation, its arguments, and its stamp. */
export interface PendingOp {
  /** Unique id; the server remembers it so a resent change is never applied twice. */
  id: string;
  name: OpName;
  args: unknown[];
  env: OpEnv;
}

export function runOp(d: AppData, op: PendingOp): [AppData, unknown] {
  const fn = OPS[op.name] as unknown as Fn | undefined;
  if (!fn) return [d, undefined];
  return fn(d, op.env, ...op.args);
}
