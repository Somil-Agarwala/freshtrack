import { issueBagNumber, issueCollectionNumbers, issueDispatchNumber, refreshBags } from "../bag-packing";
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

/** The bag being filled for a company and MRP, if any (oldest number first). */
function openBagFor(bags: SortedBag[], companyId: string, mrp: number): SortedBag | undefined {
  return bags.filter((b) => b.status === "open" && b.companyId === companyId && b.mrp === mrp).sort((a, b) => a.bagNumber.localeCompare(b.bagNumber))[0];
}

/** A new, empty, numbered bag. Takes a number from `seq` (mutated). */
function newBag(d: AppData, env: OpEnv, companyId: string, mrp: number, seq: AppData["seq"]): SortedBag {
  const bagNumber = issueBagNumber(d.companies, companyId, mrp, env.today, seq);
  return { id: `sb-${bagNumber}`, bagNumber, companyId, mrp, pieceCount: 0, isFull: false, createdDate: env.today, status: "open", sourceCollectionIds: [], items: [], contents: [], claimValue: 0 };
}

/** When goods came in: the pickup's date, or the godown entry's -- oldest are bagged first. */
function waitingAge(d: AppData) {
  const pickup = new Map(d.collections.map((c) => [c.id, c.collectedDate]));
  const entry = new Map(d.records.map((r) => [`godown:${r.id}`, r.date]));
  return (l: CountLine) => pickup.get(l.collectionId) ?? entry.get(l.collectionId) ?? "9999";
}

/** A counted pickup is "in bags" once none of its pieces are waiting any more. */
function pickupStatus(collections: CollectionBag[], countLines: CountLine[]): CollectionBag[] {
  const waiting = new Set(countLines.filter((l) => !l.bagId).map((l) => l.collectionId));
  const has = new Set(countLines.map((l) => l.collectionId));
  return collections.map((c) => {
    if (c.status === "uncounted") return c;
    const status = has.has(c.id) && !waiting.has(c.id) ? ("packed" as const) : ("counted" as const);
    return c.status === status ? c : { ...c, status };
  });
}

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
   * as a direct entry, with its count saved at once. The pieces then wait to
   * be put into bags, like any counted goods.
   */
  addCountedPickup(d: AppData, env: OpEnv, input: CollectionInput, lines: CountInput): Result<CollectionBag | null> {
    if (!lines.some((l) => l.quantity > 0)) return [d, null];
    const [withPickup, created] = OPS.addCollections(d, env, input, 1);
    const id = created[0].id;
    const marked = { ...withPickup, collections: withPickup.collections.map((c) => (c.id === id ? { ...c, direct: true } : c)) };
    const [counted] = OPS.saveCount(marked, env, id, lines);
    return [counted, counted.collections.find((c) => c.id === id) ?? null];
  },

  /** Notes that the party was sent the WhatsApp summary of these pickup bags. */
  markPartyNotified(d: AppData, env: OpEnv, ids: string[]): Result<void> {
    const idSet = new Set(ids);
    return [{ ...d, collections: d.collections.map((c) => (idSet.has(c.id) ? { ...c, partyNotified: env.today } : c)) }, undefined];
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

  /**
   * Saves a pickup's count. Counted pieces wait, sorted by MRP, until staff
   * put them into a bag and say how many (fillBag) -- nothing is put into a
   * bag automatically.
   *
   * A re-count only changes what is still waiting: pieces already put into a
   * bag stay there, so a corrected count can never be lower than what has
   * been bagged for an item (refused: false).
   */
  saveCount(d: AppData, env: OpEnv, collectionId: string, lines: CountInput): Result<boolean> {
    const pickup = d.collections.find((c) => c.id === collectionId);
    if (!pickup) return [d, false];
    const companyId = pickup.companyId;
    const key = (productId: string, mrp: number) => `${productId}:${mrp}`;

    const old = d.countLines.filter((l) => l.collectionId === collectionId);
    const bagged = old.filter((l) => l.bagId);
    const inBags = new Map<string, number>();
    bagged.forEach((l) => inBags.set(key(l.productId, l.mrp), (inBags.get(key(l.productId, l.mrp)) ?? 0) + l.quantity));
    const wanted = new Map<string, number>();
    lines.forEach((l) => wanted.set(key(l.productId, l.mrp), (wanted.get(key(l.productId, l.mrp)) ?? 0) + Math.max(0, l.quantity)));
    for (const [k, n] of inBags) if ((wanted.get(k) ?? 0) < n) return [d, false];

    const fresh: CountLine[] = [];
    lines.forEach((line, index) => {
      const k = key(line.productId, line.mrp);
      const already = inBags.get(k) ?? 0;
      const waiting = Math.max(0, line.quantity) - already;
      inBags.set(k, Math.max(0, already - Math.max(0, line.quantity)));
      if (waiting <= 0) return;
      fresh.push({
        id: `cl-${env.stamp}-${index}`,
        collectionId,
        companyId,
        productId: line.productId,
        mrp: line.mrp,
        quantity: waiting,
        // The claim rate is fixed at count time, like the MRP.
        rate: d.products.find((p) => p.id === line.productId)?.claimRate,
        packed: false,
      });
    });

    const countLines = [...d.countLines.filter((l) => l.collectionId !== collectionId), ...bagged, ...fresh];
    const counted = d.collections.map((c) => (c.id === collectionId ? { ...c, status: "counted" as const, countedDate: env.today, countedBy: env.actor } : c));
    return [{ ...d, countLines, sortedBags: refreshBags(d.sortedBags, countLines), collections: pickupStatus(counted, countLines) }, true];
  },

  /**
   * Starts a new numbered bag for a company and MRP, or returns the one
   * already open. One bag per company and MRP is being filled at a time.
   */
  openBag(d: AppData, env: OpEnv, companyId: string, mrp: number): Result<SortedBag> {
    const open = openBagFor(d.sortedBags, companyId, mrp);
    if (open) return [d, open];
    const seq = { ...d.seq };
    const bag = newBag(d, env, companyId, mrp, seq);
    return [{ ...d, seq, sortedBags: [...d.sortedBags, bag] }, bag];
  },

  /**
   * Staff put goods into the open bag of a company and MRP and say how many
   * of each item went in. Those pieces move from "waiting" into the bag
   * (a bag is opened, with a new number, if none is). Pieces come from
   * `from` (a pickup, or "godown:<entry>") first, then the oldest waiting.
   * Asking for more than is waiting puts in what is waiting.
   */
  fillBag(d: AppData, env: OpEnv, companyId: string, mrp: number, items: { productId: string; pieces: number }[], from?: string): Result<{ bag: SortedBag; added: number } | null> {
    const wanted = items.filter((i) => i.pieces > 0);
    if (wanted.length === 0) return [d, null];
    const seq = { ...d.seq };
    let sortedBags = d.sortedBags;
    let bag = openBagFor(sortedBags, companyId, mrp);
    if (!bag) {
      bag = newBag(d, env, companyId, mrp, seq);
      sortedBags = [...sortedBags, bag];
    }

    const age = waitingAge(d);
    const lines = [...d.countLines];
    const added: CountLine[] = [];
    let total = 0;
    wanted.forEach((item) => {
      let left = Math.floor(item.pieces);
      lines
        .map((l, index) => ({ l, index }))
        .filter(({ l }) => !l.bagId && l.companyId === companyId && l.mrp === mrp && l.productId === item.productId)
        .sort((a, b) => Number(b.l.collectionId === from) - Number(a.l.collectionId === from) || age(a.l).localeCompare(age(b.l)) || a.index - b.index)
        .forEach(({ l, index }, k) => {
          if (left <= 0) return;
          const take = Math.min(left, l.quantity);
          if (take === l.quantity) lines[index] = { ...l, bagId: bag!.id, packed: true };
          else {
            lines[index] = { ...l, quantity: l.quantity - take };
            added.push({ ...l, id: `${l.id}~${env.stamp}${k}`, quantity: take, bagId: bag!.id, packed: true });
          }
          left -= take;
          total += take;
        });
    });
    if (total === 0) return [d, null];

    const countLines = [...lines, ...added];
    const refreshed = refreshBags(sortedBags, countLines);
    return [
      { ...d, seq, countLines, sortedBags: refreshed, collections: pickupStatus(d.collections, countLines) },
      { bag: refreshed.find((b) => b.id === bag!.id)!, added: total },
    ];
  },

  /**
   * A mistake while filling: pieces of an item taken back out of an open
   * bag; they are waiting again. The last ones put in come out first.
   */
  takeOutOfBag(d: AppData, env: OpEnv, bagId: string, productId: string, pieces: number): Result<number> {
    const bag = d.sortedBags.find((b) => b.id === bagId);
    if (!bag || bag.status !== "open" || pieces <= 0) return [d, 0];
    let left = Math.floor(pieces);
    const lines = [...d.countLines];
    const added: CountLine[] = [];
    lines
      .map((l, index) => ({ l, index }))
      .filter(({ l }) => l.bagId === bagId && l.productId === productId)
      .reverse()
      .forEach(({ l, index }, k) => {
        if (left <= 0) return;
        const take = Math.min(left, l.quantity);
        if (take === l.quantity) lines[index] = { ...l, bagId: undefined, packed: false };
        else {
          lines[index] = { ...l, quantity: l.quantity - take };
          added.push({ ...l, id: `${l.id}~${env.stamp}${k}`, quantity: take, bagId: undefined, packed: false });
        }
        left -= take;
      });
    const moved = Math.floor(pieces) - left;
    if (moved === 0) return [d, 0];
    const countLines = [...lines, ...added];
    return [{ ...d, countLines, sortedBags: refreshBags(d.sortedBags, countLines), collections: pickupStatus(d.collections, countLines) }, moved];
  },

  /**
   * A manager ties a bag when it is full. If goods of that MRP are still
   * waiting, the next numbered bag is opened at once, so its number can be
   * written on a fresh bag. Null if the bag is not open or is empty.
   */
  tieBag(d: AppData, env: OpEnv, bagId: string): Result<{ tied: SortedBag; next: SortedBag | null } | null> {
    const bag = d.sortedBags.find((b) => b.id === bagId);
    if (!bag || bag.status !== "open" || bag.pieceCount <= 0) return [d, null];
    const done = tied(bag, env);
    const sortedBags = d.sortedBags.map((b) => (b.id === bagId ? done : b));
    const waiting = d.countLines.some((l) => !l.bagId && l.companyId === bag.companyId && l.mrp === bag.mrp);
    if (!waiting) return [{ ...d, sortedBags }, { tied: done, next: null }];
    const seq = { ...d.seq };
    const next = newBag(d, env, bag.companyId, bag.mrp, seq);
    return [{ ...d, seq, sortedBags: [...sortedBags, next] }, { tied: done, next }];
  },

  /**
   * Opens a bag tied by mistake, so it is filled again. Refused (false) once
   * it has gone to the factory, or while another bag of the same MRP has
   * goods in it; an empty one opened after the tie is removed.
   */
  untieBag(d: AppData, _env: OpEnv, bagId: string): Result<boolean> {
    const bag = d.sortedBags.find((b) => b.id === bagId);
    if (!bag || bag.status !== "ready") return [d, false];
    const others = d.sortedBags.filter((b) => b.id !== bagId && b.status === "open" && b.companyId === bag.companyId && b.mrp === bag.mrp);
    if (others.some((b) => b.pieceCount > 0)) return [d, false];
    const drop = new Set(others.map((b) => b.id));
    return [
      {
        ...d,
        sortedBags: d.sortedBags
          .filter((b) => !drop.has(b.id))
          .map((b) => (b.id === bagId ? { ...b, status: "open" as const, isFull: false, tiedBy: undefined, tiedDate: undefined, closedEarly: undefined } : b)),
      },
      true,
    ];
  },

  /** Ties every open bag of a company that has goods in it, e.g. before a factory run. Returns the bags tied. */
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

    // Damage in our own godown is claimed from the factory like any other:
    // its pieces wait with the counted goods of that MRP, tagged as our own,
    // until staff put them into a bag.
    const product = d.products.find((p) => p.id === record.productId);
    if (record.source === "own_inventory" && product && (record.pieces ?? 0) > 0) {
      next.countLines = [
        ...d.countLines,
        {
          id: `gl-${created.id}`,
          collectionId: `godown:${created.id}`,
          recordId: created.id,
          companyId: record.companyId,
          productId: product.id,
          mrp: product.mrp,
          quantity: record.pieces!,
          rate: product.claimRate,
          packed: false,
        },
      ];
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
