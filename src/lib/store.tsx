"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  collectionBags as seedCollections,
  companies as seedCompanies,
  distributors as seedDistributors,
  countLines as seedCountLines,
  dispatches as seedDispatches,
  products as seedProducts,
  records as seedRecords,
  sortedBags as seedSortedBags,
} from "./mock-data";
import * as ops from "./operations";
import type { PackOptions } from "./bag-packing";
import type { AppData, Outcome } from "./operations";
import type { CollectionBag, Company, CountLine, DamageRecord, Dispatch, Distributor, Product, SortedBag } from "@/types";

/**
 * One in-memory store shared by every page, so the pipeline genuinely
 * flows: counting a collection makes its pieces appear on the packing
 * screen, packing creates real bags, and dispatching moves those bags.
 *
 * The rules themselves live in ./operations.ts as pure functions. This file
 * only holds the current data and runs an operation against it. When
 * Supabase is wired up, each action below calls the matching database
 * function instead, and the components calling them do not change.
 *
 * State is per-session and resets on refresh until the database is connected.
 */
interface StoreValue {
  /** False on the server and during the first client render. */
  ready: boolean;
  companies: Company[];
  distributors: Distributor[];
  products: Product[];
  collections: CollectionBag[];
  countLines: CountLine[];
  sortedBags: SortedBag[];
  dispatches: Dispatch[];
  records: DamageRecord[];

  addProduct: (product: Omit<Product, "id">) => Product;
  addCollections: (input: ops.NewCollectionInput, bagCount: number) => CollectionBag[];
  /** What the next `count` collection numbers would be, without consuming them. */
  previewCollectionNumbers: (companyId: string, collectedDate: string, count: number) => string[];
  deleteCollections: (ids: string[]) => ops.DeleteCollectionsResult;
  saveCount: (collectionId: string, lines: ops.CountInput[]) => ops.SaveCountResult;
  packPendingForCompany: (companyId: string, options?: PackOptions) => ops.PackResult;
  packPendingLines: (options?: PackOptions) => ops.PackResult;
  deleteSortedBags: (ids: string[]) => ops.DeleteBagsResult;
  createDispatch: (bagIds: string[]) => ops.CreateDispatchResult;
  recordSettlement: (dispatchId: string, receivedValue: number) => boolean;
  markDispatch: (dispatchId: string, status: "under_review" | "rejected") => boolean;
  deleteDispatches: (ids: string[]) => ops.DeleteDispatchesResult;
  addRecord: (record: Omit<DamageRecord, "id">) => DamageRecord;
  deleteRecords: (ids: string[]) => number;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadSeed(): AppData {
  return ops.initialData({
    companies: seedCompanies,
    distributors: seedDistributors,
    products: seedProducts,
    collections: seedCollections,
    countLines: seedCountLines,
    sortedBags: seedSortedBags,
    dispatches: seedDispatches,
    records: seedRecords,
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadSeed);
  // The ref always holds the latest data, so two actions fired back to back
  // each see the other's result, and a number is never issued twice.
  const dataRef = useRef(data);

  // Sample dates are relative to today, so the server's copy and the
  // browser's copy can disagree. Pages render data only once in the browser.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const run = useCallback(<R,>(apply: (current: AppData) => Outcome<R>): R => {
    const { data: next, result } = apply(dataRef.current);
    if (next !== dataRef.current) {
      dataRef.current = next;
      setData(next);
    }
    return result;
  }, []);

  const actions = useMemo(
    () => ({
      addProduct: (product: Omit<Product, "id">) => run((d) => ops.addProduct(d, product)),
      addCollections: (input: ops.NewCollectionInput, bagCount: number) => run((d) => ops.addCollections(d, input, bagCount)),
      previewCollectionNumbers: (companyId: string, collectedDate: string, count: number) =>
        ops.previewCollectionNumbers(dataRef.current, companyId, collectedDate, count),
      deleteCollections: (ids: string[]) => run((d) => ops.deleteCollections(d, ids)),
      saveCount: (collectionId: string, lines: ops.CountInput[]) => run((d) => ops.saveCount(d, collectionId, lines)),
      packPendingForCompany: (companyId: string, options?: PackOptions) => run((d) => ops.pack(d, { companyId }, options)),
      packPendingLines: (options?: PackOptions) => run((d) => ops.pack(d, {}, options)),
      deleteSortedBags: (ids: string[]) => run((d) => ops.deleteSortedBags(d, ids)),
      createDispatch: (bagIds: string[]) => run((d) => ops.createDispatch(d, bagIds)),
      recordSettlement: (dispatchId: string, receivedValue: number) => run((d) => ops.recordSettlement(d, dispatchId, receivedValue)),
      markDispatch: (dispatchId: string, status: "under_review" | "rejected") => run((d) => ops.markDispatch(d, dispatchId, status)),
      deleteDispatches: (ids: string[]) => run((d) => ops.deleteDispatches(d, ids)),
      addRecord: (record: Omit<DamageRecord, "id">) => run((d) => ops.addRecord(d, record)),
      deleteRecords: (ids: string[]) => run((d) => ops.deleteRecords(d, ids)),
    }),
    [run]
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      companies: data.companies,
      distributors: data.distributors,
      products: data.products,
      collections: data.collections,
      countLines: data.countLines,
      sortedBags: data.sortedBags,
      dispatches: data.dispatches,
      records: data.records,
      ...actions,
    }),
    [ready, data, actions]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
