import {
  issueCollectionNumbers,
  issueDispatchNumber,
  peekCollectionNumbers,
  pendingQuantity,
  planPacking,
  seedSequence,
  type PackOptions,
  type SequenceState,
} from "./bag-packing";
import { newId, today, yearOf } from "./utils";
import type {
  CollectionBag,
  CollectionStatus,
  Company,
  CountLine,
  DamageRecord,
  Dispatch,
  Distributor,
  Product,
  SortedBag,
} from "@/types";

/**
 * Every business rule that changes data lives here, as plain functions:
 * old data in, new data plus a result out. Nothing here touches React, so
 * the rules can be tested on their own, and each function maps one-to-one
 * onto a Postgres function in supabase/migrations.
 *
 * The rules that keep the pipeline consistent:
 *
 *   - A count can only be edited while none of its pieces are packed.
 *   - A sorted bag can only be deleted while it is "ready". Its pieces go
 *     back to the packing queue. A dispatched bag is physically at the
 *     factory and can only leave with its dispatch.
 *   - Deleting a dispatch that has not been settled CANCELS it: its bags go
 *     back to "ready". Deleting a settled, part-settled or rejected dispatch
 *     CLEARS it: the dispatch and its bags are removed together.
 *   - A collection bag can only be deleted once no sorted bag holds its
 *     pieces, so no bag ever points at a party that no longer exists.
 *   - Numbers only ever move forward, so a deleted number is never reused.
 */
export interface AppData {
  companies: Company[];
  distributors: Distributor[];
  products: Product[];
  collections: CollectionBag[];
  countLines: CountLine[];
  sortedBags: SortedBag[];
  dispatches: Dispatch[];
  records: DamageRecord[];
  sequence: SequenceState;
}

export interface Outcome<R> {
  data: AppData;
  result: R;
}

function codeFor(data: AppData, companyId: string): string {
  return data.companies.find((c) => c.id === companyId)?.code ?? "GEN";
}

/** Builds the starting data and seeds the number counters from it. */
export function initialData(seed: Omit<AppData, "sequence">): AppData {
  const sequence: SequenceState = {};
  seed.companies.forEach((company) => {
    const own = <T extends { companyId: string }>(rows: T[]) => rows.filter((r) => r.companyId === company.id);
    const years = new Set<number>([yearOf(today())]);
    own(seed.collections).forEach((c) => years.add(yearOf(c.collectedDate)));
    own(seed.sortedBags).forEach((b) => years.add(yearOf(b.createdDate)));
    own(seed.dispatches).forEach((d) => years.add(yearOf(d.sentDate)));

    years.forEach((year) => {
      seedSequence(sequence, company.id, "COL", year, own(seed.collections).map((c) => c.bagNumber));
      seedSequence(sequence, company.id, "BAG", year, own(seed.sortedBags).map((b) => b.bagNumber));
      seedSequence(sequence, company.id, "DSP", year, own(seed.dispatches).map((d) => d.dispatchNumber));
    });
  });
  return { ...seed, sequence };
}

/**
 * Where a collection bag stands, worked out from its lines rather than
 * stored separately, so it can never disagree with them.
 */
export function collectionStatusFrom(lines: CountLine[]): CollectionStatus {
  if (lines.length === 0) return "uncounted";
  return lines.every((l) => pendingQuantity(l) === 0) ? "packed" : "counted";
}

function refreshStatuses(collections: CollectionBag[], countLines: CountLine[], touched: Set<string>): CollectionBag[] {
  if (touched.size === 0) return collections;
  return collections.map((c) => {
    if (!touched.has(c.id)) return c;
    const status = collectionStatusFrom(countLines.filter((l) => l.collectionId === c.id));
    return status === c.status ? c : { ...c, status };
  });
}

/* ------------------------------------------------------------------ */
/* Master data                                                         */
/* ------------------------------------------------------------------ */

export function addProduct(data: AppData, product: Omit<Product, "id">): Outcome<Product> {
  const created: Product = { ...product, id: newId() };
  return { data: { ...data, products: [...data.products, created] }, result: created };
}

/* ------------------------------------------------------------------ */
/* 1. Collect                                                          */
/* ------------------------------------------------------------------ */

export interface NewCollectionInput {
  companyId: string;
  distributorId: string;
  collectedDate: string;
  estimatedPieces?: number;
  notes?: string;
}

export function addCollections(data: AppData, input: NewCollectionInput, bagCount: number): Outcome<CollectionBag[]> {
  // One pickup usually means several bags from the same party, so the whole
  // batch is numbered in one pass from the company's own counter.
  const count = Math.max(1, Math.floor(bagCount));
  const sequence = { ...data.sequence };
  const numbers = issueCollectionNumbers(codeFor(data, input.companyId), input.companyId, input.collectedDate, sequence, count);

  const created: CollectionBag[] = numbers.map((bagNumber) => ({
    id: newId(),
    bagNumber,
    companyId: input.companyId,
    distributorId: input.distributorId,
    collectedDate: input.collectedDate,
    status: "uncounted",
    estimatedPieces: input.estimatedPieces,
    notes: input.notes,
  }));

  // Reversed so the highest number sits at the top of the newest-first list.
  return {
    data: { ...data, sequence, collections: [...created.slice().reverse(), ...data.collections] },
    result: created,
  };
}

/** What the next `count` collection numbers would be, without using them up. */
export function previewCollectionNumbers(data: AppData, companyId: string, collectedDate: string, count: number): string[] {
  return peekCollectionNumbers(codeFor(data, companyId), companyId, collectedDate, data.sequence, Math.max(1, Math.floor(count)));
}

export type DeleteCollectionsResult = { deleted: number; blocked: string[] };

export function deleteCollections(data: AppData, ids: string[]): Outcome<DeleteCollectionsResult> {
  const inBags = new Set(data.sortedBags.flatMap((b) => b.contents.map((c) => c.collectionId)));
  const idSet = new Set(ids);
  const requested = data.collections.filter((c) => idSet.has(c.id));
  const blocked = requested.filter((c) => inBags.has(c.id));
  const removable = new Set(requested.filter((c) => !inBags.has(c.id)).map((c) => c.id));

  if (removable.size === 0) return { data, result: { deleted: 0, blocked: blocked.map((c) => c.bagNumber) } };

  return {
    data: {
      ...data,
      collections: data.collections.filter((c) => !removable.has(c.id)),
      countLines: data.countLines.filter((l) => !removable.has(l.collectionId)),
    },
    result: { deleted: removable.size, blocked: blocked.map((c) => c.bagNumber) },
  };
}

/* ------------------------------------------------------------------ */
/* 2. Count                                                            */
/* ------------------------------------------------------------------ */

export interface CountInput {
  productId: string;
  mrp: number;
  quantity: number;
}

export type SaveCountResult = { ok: true } | { ok: false; reason: string };

export function saveCount(data: AppData, collectionId: string, input: CountInput[]): Outcome<SaveCountResult> {
  const collection = data.collections.find((c) => c.id === collectionId);
  if (!collection) return { data, result: { ok: false, reason: "That collection bag no longer exists." } };

  const existing = data.countLines.filter((l) => l.collectionId === collectionId);
  if (existing.some((l) => l.packedQuantity > 0)) {
    return {
      data,
      result: { ok: false, reason: "Some of these pieces are already in sorted bags. Delete those bags first to change the count." },
    };
  }

  // The same SKU twice becomes one line, and empty lines are dropped.
  const merged = new Map<string, CountInput>();
  input.forEach((line) => {
    const quantity = Math.floor(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const prev = merged.get(line.productId);
    merged.set(line.productId, prev ? { ...prev, quantity: prev.quantity + quantity } : { ...line, quantity });
  });
  if (merged.size === 0) return { data, result: { ok: false, reason: "Add at least one counted line." } };

  // The bag's company is copied onto every line, so packing can group by
  // company without joining back through the collection.
  const created: CountLine[] = Array.from(merged.values()).map((line) => ({
    id: newId(),
    collectionId,
    companyId: collection.companyId,
    productId: line.productId,
    mrp: line.mrp,
    quantity: line.quantity,
    packedQuantity: 0,
  }));

  return {
    data: {
      ...data,
      countLines: [...data.countLines.filter((l) => l.collectionId !== collectionId), ...created],
      collections: data.collections.map((c) =>
        c.id === collectionId ? { ...c, status: "counted", countedDate: today() } : c
      ),
    },
    result: { ok: true },
  };
}

/* ------------------------------------------------------------------ */
/* 3. Pack                                                             */
/* ------------------------------------------------------------------ */

export type PackResult = { bagCount: number; pieceCount: number };

export function pack(data: AppData, scope: { companyId?: string }, options: PackOptions = {}): Outcome<PackResult> {
  const eligible = data.countLines.filter(
    (l) => pendingQuantity(l) > 0 && (scope.companyId == null || l.companyId === scope.companyId)
  );
  if (eligible.length === 0) return { data, result: { bagCount: 0, pieceCount: 0 } };

  const sequence = { ...data.sequence };
  const { bags, taken } = planPacking(eligible, data.collections, data.companies, today(), sequence, options);
  if (bags.length === 0) return { data, result: { bagCount: 0, pieceCount: 0 } };

  const countLines = data.countLines.map((l) =>
    taken.has(l.id) ? { ...l, packedQuantity: l.packedQuantity + (taken.get(l.id) ?? 0) } : l
  );
  const touched = new Set(eligible.filter((l) => taken.has(l.id)).map((l) => l.collectionId));

  return {
    data: {
      ...data,
      sequence,
      countLines,
      sortedBags: [...data.sortedBags, ...bags],
      collections: refreshStatuses(data.collections, countLines, touched),
    },
    result: { bagCount: bags.length, pieceCount: bags.reduce((sum, b) => sum + b.pieceCount, 0) },
  };
}

export type DeleteBagsResult = { deleted: number; skippedDispatched: number; piecesReturned: number };

/**
 * Deletes ready bags and returns their pieces to the packing queue, so
 * nothing counted ever silently disappears. Dispatched bags are skipped.
 */
export function deleteSortedBags(data: AppData, ids: string[]): Outcome<DeleteBagsResult> {
  const idSet = new Set(ids);
  const requested = data.sortedBags.filter((b) => idSet.has(b.id));
  const removable = requested.filter((b) => b.status === "ready");
  const skippedDispatched = requested.length - removable.length;
  if (removable.length === 0) return { data, result: { deleted: 0, skippedDispatched, piecesReturned: 0 } };

  const returned = new Map<string, number>();
  removable.forEach((bag) =>
    bag.contents.forEach((c) => returned.set(c.countLineId, (returned.get(c.countLineId) ?? 0) + c.quantity))
  );

  const countLines = data.countLines.map((l) =>
    returned.has(l.id) ? { ...l, packedQuantity: Math.max(0, l.packedQuantity - (returned.get(l.id) ?? 0)) } : l
  );
  const removeIds = new Set(removable.map((b) => b.id));
  const touched = new Set(removable.flatMap((b) => b.contents.map((c) => c.collectionId)));

  return {
    data: {
      ...data,
      countLines,
      sortedBags: data.sortedBags.filter((b) => !removeIds.has(b.id)),
      collections: refreshStatuses(data.collections, countLines, touched),
    },
    result: {
      deleted: removable.length,
      skippedDispatched,
      piecesReturned: removable.reduce((sum, b) => sum + b.pieceCount, 0),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 4. Dispatch and settle                                              */
/* ------------------------------------------------------------------ */

export type CreateDispatchResult = { ok: true; dispatch: Dispatch } | { ok: false; reason: string };

export function createDispatch(data: AppData, bagIds: string[]): Outcome<CreateDispatchResult> {
  const idSet = new Set(bagIds);
  const selected = data.sortedBags.filter((b) => idSet.has(b.id) && b.status === "ready");
  if (selected.length === 0) return { data, result: { ok: false, reason: "Select at least one bag that is ready to send." } };

  // A dispatch goes to one company's factory, so a mixed one is refused
  // rather than silently creating a claim no factory will accept.
  const companyId = selected[0].companyId;
  if (selected.some((b) => b.companyId !== companyId)) {
    return { data, result: { ok: false, reason: "A dispatch can only hold one company's bags." } };
  }

  const sequence = { ...data.sequence };
  const sentDate = today();
  const dispatch: Dispatch = {
    id: newId(),
    dispatchNumber: issueDispatchNumber(codeFor(data, companyId), companyId, sentDate, sequence),
    companyId,
    sentDate,
    bagCount: selected.length,
    pieceCount: selected.reduce((sum, b) => sum + b.pieceCount, 0),
    claimedValue: selected.reduce((sum, b) => sum + b.pieceCount * b.mrp, 0),
    status: "sent",
  };
  const sentIds = new Set(selected.map((b) => b.id));

  return {
    data: {
      ...data,
      sequence,
      dispatches: [dispatch, ...data.dispatches],
      sortedBags: data.sortedBags.map((b) => (sentIds.has(b.id) ? { ...b, status: "dispatched", dispatchId: dispatch.id } : b)),
    },
    result: { ok: true, dispatch },
  };
}

function isOpen(dispatch: Dispatch): boolean {
  return dispatch.status === "sent" || dispatch.status === "under_review";
}

/** Records what the factory paid. A short payment stays "partially settled". */
export function recordSettlement(data: AppData, dispatchId: string, receivedValue: number): Outcome<boolean> {
  const dispatch = data.dispatches.find((d) => d.id === dispatchId);
  if (!dispatch || !isOpen(dispatch) || !Number.isFinite(receivedValue) || receivedValue < 0) return { data, result: false };

  const updated: Dispatch = {
    ...dispatch,
    receivedValue,
    status: receivedValue < dispatch.claimedValue ? "partially_settled" : "settled",
    settledDate: today(),
  };
  return { data: { ...data, dispatches: data.dispatches.map((d) => (d.id === dispatchId ? updated : d)) }, result: true };
}

/** "Under review" once the factory acknowledges; "rejected" if it refuses the claim. */
export function markDispatch(data: AppData, dispatchId: string, status: "under_review" | "rejected"): Outcome<boolean> {
  const dispatch = data.dispatches.find((d) => d.id === dispatchId);
  if (!dispatch) return { data, result: false };
  if (status === "under_review" && dispatch.status !== "sent") return { data, result: false };
  if (status === "rejected" && !isOpen(dispatch)) return { data, result: false };

  const updated: Dispatch =
    status === "rejected" ? { ...dispatch, status, receivedValue: 0, settledDate: today() } : { ...dispatch, status };
  return { data: { ...data, dispatches: data.dispatches.map((d) => (d.id === dispatchId ? updated : d)) }, result: true };
}

export type DeleteDispatchesResult = { cancelled: number; cleared: number; bagsReturned: number; bagsRemoved: number };

export function deleteDispatches(data: AppData, ids: string[]): Outcome<DeleteDispatchesResult> {
  const idSet = new Set(ids);
  const requested = data.dispatches.filter((d) => idSet.has(d.id));
  const cancelIds = new Set(requested.filter(isOpen).map((d) => d.id));
  const clearIds = new Set(requested.filter((d) => !isOpen(d)).map((d) => d.id));
  if (requested.length === 0) return { data, result: { cancelled: 0, cleared: 0, bagsReturned: 0, bagsRemoved: 0 } };

  let bagsReturned = 0;
  let bagsRemoved = 0;
  const sortedBags: SortedBag[] = [];
  data.sortedBags.forEach((bag) => {
    if (bag.dispatchId && cancelIds.has(bag.dispatchId)) {
      bagsReturned += 1;
      sortedBags.push({ ...bag, status: "ready", dispatchId: undefined });
    } else if (bag.dispatchId && clearIds.has(bag.dispatchId)) {
      bagsRemoved += 1;
    } else {
      sortedBags.push(bag);
    }
  });

  return {
    data: {
      ...data,
      sortedBags,
      dispatches: data.dispatches.filter((d) => !cancelIds.has(d.id) && !clearIds.has(d.id)),
    },
    result: { cancelled: cancelIds.size, cleared: clearIds.size, bagsReturned, bagsRemoved },
  };
}

/* ------------------------------------------------------------------ */
/* Own-inventory records                                               */
/* ------------------------------------------------------------------ */

export function addRecord(data: AppData, record: Omit<DamageRecord, "id">): Outcome<DamageRecord> {
  const created: DamageRecord = { ...record, id: newId() };
  return { data: { ...data, records: [created, ...data.records] }, result: created };
}

export function deleteRecords(data: AppData, ids: string[]): Outcome<number> {
  const idSet = new Set(ids);
  const records = data.records.filter((r) => !idSet.has(r.id));
  return { data: { ...data, records }, result: data.records.length - records.length };
}
