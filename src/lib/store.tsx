"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  collectionBags as seedCollections,
  countLines as seedCountLines,
  dispatches as seedDispatches,
  products as seedProducts,
  records as seedRecords,
  sortedBags as seedSortedBags,
} from "./mock-data";
import { buildMrpTiers, nextCollectionNumber, nextDispatchNumber, packTiersIntoBags } from "./bag-packing";
import { today } from "./utils";
import type { CollectionBag, CountLine, DamageRecord, Dispatch, Product, SortedBag } from "@/types";

/**
 * One in-memory store shared by every page, so the pipeline genuinely
 * flows: counting a collection makes its pieces appear on the packing
 * screen, packing creates real bags, and dispatching moves those bags.
 *
 * This is deliberately the ONLY place that mutates data. When Supabase is
 * wired up, each function below becomes a query/mutation and the
 * components calling them do not need to change.
 *
 * State is per-session and resets on refresh, which is expected until the
 * database is connected.
 */
interface StoreValue {
  products: Product[];
  collections: CollectionBag[];
  countLines: CountLine[];
  sortedBags: SortedBag[];
  dispatches: Dispatch[];
  records: DamageRecord[];

  addProduct: (product: Omit<Product, "id">) => Product;
  addCollection: (input: { distributorId: string; collectedDate: string; estimatedPieces?: number; notes?: string }) => CollectionBag;
  deleteCollections: (ids: string[]) => void;
  saveCount: (collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => void;
  packPendingLines: () => { bagCount: number; pieceCount: number };
  deleteSortedBags: (ids: string[]) => void;
  createDispatch: (bagIds: string[]) => Dispatch | null;
  recordSettlement: (dispatchId: string, receivedValue: number) => void;
  deleteDispatches: (ids: string[]) => void;
  addRecord: (record: Omit<DamageRecord, "id">) => void;
  deleteRecords: (ids: string[]) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [collections, setCollections] = useState<CollectionBag[]>(seedCollections);
  const [countLines, setCountLines] = useState<CountLine[]>(seedCountLines);
  const [sortedBags, setSortedBags] = useState<SortedBag[]>(seedSortedBags);
  const [dispatches, setDispatches] = useState<Dispatch[]>(seedDispatches);
  const [records, setRecords] = useState<DamageRecord[]>(seedRecords);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    const created: Product = { ...product, id: `p-${Date.now()}` };
    setProducts((prev) => [...prev, created]);
    return created;
  }, []);

  const addCollection = useCallback(
    (input: { distributorId: string; collectedDate: string; estimatedPieces?: number; notes?: string }) => {
      // Built outside the updater: assigning inside one and reading it
      // afterwards is not reliable, since React may defer or re-run it.
      const created: CollectionBag = {
        id: `c-${Date.now()}`,
        bagNumber: nextCollectionNumber(collections.length, input.collectedDate),
        distributorId: input.distributorId,
        collectedDate: input.collectedDate,
        status: "uncounted",
        estimatedPieces: input.estimatedPieces,
        notes: input.notes,
      };
      setCollections((prev) => [created, ...prev]);
      return created;
    },
    [collections.length]
  );

  const deleteCollections = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setCollections((prev) => prev.filter((c) => !idSet.has(c.id)));
    setCountLines((prev) => prev.filter((l) => !idSet.has(l.collectionId)));
  }, []);

  const saveCount = useCallback((collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => {
    setCountLines((prev) => {
      const withoutOld = prev.filter((l) => l.collectionId !== collectionId);
      const created: CountLine[] = lines.map((line, index) => ({
        id: `cl-${Date.now()}-${index}`,
        collectionId,
        productId: line.productId,
        mrp: line.mrp,
        quantity: line.quantity,
        packed: false,
      }));
      return [...withoutOld, ...created];
    });
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, status: "counted", countedDate: today() } : c))
    );
  }, []);

  const packPendingLines = useCallback(() => {
    const tiers = buildMrpTiers(countLines);
    if (tiers.length === 0) return { bagCount: 0, pieceCount: 0 };

    const created = packTiersIntoBags(tiers, sortedBags.length, today());
    const packedCollectionIds = new Set(countLines.filter((l) => !l.packed).map((l) => l.collectionId));

    setSortedBags((prev) => [...prev, ...created]);
    setCountLines((prev) => prev.map((l) => (l.packed ? l : { ...l, packed: true })));
    setCollections((prev) => prev.map((c) => (packedCollectionIds.has(c.id) ? { ...c, status: "packed" } : c)));

    return {
      bagCount: created.length,
      pieceCount: created.reduce((sum, b) => sum + b.pieceCount, 0),
    };
  }, [countLines, sortedBags.length]);

  const deleteSortedBags = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setSortedBags((prev) => prev.filter((b) => !idSet.has(b.id)));
  }, []);

  const createDispatch = useCallback(
    (bagIds: string[]) => {
      const idSet = new Set(bagIds);
      const selected = sortedBags.filter((b) => idSet.has(b.id) && b.status === "ready");
      if (selected.length === 0) return null;

      const dispatch: Dispatch = {
        id: `dp-${Date.now()}`,
        dispatchNumber: nextDispatchNumber(dispatches.length, today()),
        sentDate: today(),
        bagCount: selected.length,
        pieceCount: selected.reduce((sum, b) => sum + b.pieceCount, 0),
        claimedValue: selected.reduce((sum, b) => sum + b.pieceCount * b.mrp, 0),
        status: "sent",
      };

      setDispatches((prev) => [dispatch, ...prev]);
      setSortedBags((prev) =>
        prev.map((b) => (idSet.has(b.id) && b.status === "ready" ? { ...b, status: "dispatched", dispatchId: dispatch.id } : b))
      );
      return dispatch;
    },
    [dispatches.length, sortedBags]
  );

  const recordSettlement = useCallback((dispatchId: string, receivedValue: number) => {
    setDispatches((prev) =>
      prev.map((d) =>
        d.id === dispatchId
          ? {
              ...d,
              receivedValue,
              // A short payment stays visible as "partially settled" rather
              // than silently overwriting what was originally claimed.
              status: receivedValue < d.claimedValue ? "partially_settled" : "settled",
              settledDate: today(),
            }
          : d
      )
    );
  }, []);

  const deleteDispatches = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setDispatches((prev) => prev.filter((d) => !idSet.has(d.id)));
  }, []);

  const addRecord = useCallback((record: Omit<DamageRecord, "id">) => {
    setRecords((prev) => [{ ...record, id: `r-${Date.now()}` }, ...prev]);
  }, []);

  const deleteRecords = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setRecords((prev) => prev.filter((r) => !idSet.has(r.id)));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      products,
      collections,
      countLines,
      sortedBags,
      dispatches,
      records,
      addProduct,
      addCollection,
      deleteCollections,
      saveCount,
      packPendingLines,
      deleteSortedBags,
      createDispatch,
      recordSettlement,
      deleteDispatches,
      addRecord,
      deleteRecords,
    }),
    [
      products,
      collections,
      countLines,
      sortedBags,
      dispatches,
      records,
      addProduct,
      addCollection,
      deleteCollections,
      saveCount,
      packPendingLines,
      deleteSortedBags,
      createDispatch,
      recordSettlement,
      deleteDispatches,
      addRecord,
      deleteRecords,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
