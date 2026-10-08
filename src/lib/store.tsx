"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  collectionBags as seedCollections,
  companies as seedCompanies,
  distributors as seedDistributors,
  countLines as seedCountLines,
  dispatches as seedDispatches,
  products as seedProducts,
  records as seedRecords,
  users as seedUsers,
  sortedBags as seedSortedBags,
} from "./seed-data";
import {
  issueCollectionNumbers,
  issueDispatchNumber,
  peekCollectionNumbers,
  putIntoBags,
  refreshBags,
  seedSequence,
  type SequenceState,
} from "./bag-packing";
import { bagValue } from "./claim";
import { partySharesForBags } from "./pipeline";
import { today } from "./utils";
import type { CollectionBag, Company, Distributor, CountLine, DamageRecord, Dispatch, Product, SortedBag, UserAccount } from "@/types";

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
  companies: Company[];
  distributors: Distributor[];
  products: Product[];
  collections: CollectionBag[];
  countLines: CountLine[];
  sortedBags: SortedBag[];
  dispatches: Dispatch[];
  records: DamageRecord[];
  users: UserAccount[];

  /** Adds the row when its id is new, otherwise replaces it. */
  saveCompany: (company: Company) => void;
  saveProduct: (product: Product) => void;
  saveDistributor: (distributor: Distributor) => void;
  saveUser: (user: UserAccount) => void;
  updateRecord: (id: string, patch: Partial<Omit<DamageRecord, "id">>) => void;
  /** Who is signed in; every change below is stamped with this user id. */
  setActor: (userId: string | null) => void;
  addProduct: (product: Omit<Product, "id">) => Product;
  addDistributor: (distributor: Omit<Distributor, "id" | "isActive">) => Distributor;
  addCollections: (input: CollectionInput, bagCount: number) => CollectionBag[];
  /** What the next `count` collection numbers would be, without consuming them. */
  previewCollectionNumbers: (companyId: string, collectedDate: string, count: number) => string[];
  /** Deletes pickups and takes their pieces back out of their bags. Not for goods already sent. */
  deleteCollections: (ids: string[]) => void;
  /**
   * Saves a count and puts its pieces straight into numbered bags: the
   * open bag of each MRP is topped up and a new numbered bag opened when one
   * fills. Re-counting replaces the old pieces. Refused (false) once any of
   * the bag's goods have gone to the factory.
   */
  saveCount: (collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => boolean;
  /** Closes a company's open bags part-filled before a factory run. */
  closeOpenBags: (companyId: string) => SortedBag[];
  deleteSortedBags: (ids: string[]) => void;
  createDispatch: (bagIds: string[]) => Dispatch | null;
  recordSettlement: (dispatchId: string, receivedValue: number) => void;
  deleteDispatches: (ids: string[]) => void;
  addRecord: (record: Omit<DamageRecord, "id">) => void;
  deleteRecords: (ids: string[]) => void;
}

interface CollectionInput {
  companyId: string;
  distributorId: string;
  collectedDate: string;
  estimatedPieces?: number;
  notes?: string;
  photoUrl?: string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(seedCompanies);
  const [users, setUsers] = useState<UserAccount[]>(seedUsers);
  const [distributors, setDistributors] = useState<Distributor[]>(seedDistributors);
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [collections, setCollections] = useState<CollectionBag[]>(seedCollections);
  const [countLines, setCountLines] = useState<CountLine[]>(seedCountLines);
  const [sortedBags, setSortedBags] = useState<SortedBag[]>(seedSortedBags);
  const [dispatches, setDispatches] = useState<Dispatch[]>(seedDispatches);
  const [records, setRecords] = useState<DamageRecord[]>(seedRecords);

  /**
   * Forward-only numbering counters, seeded once from the numbers already
   * present so seed rows are never re-issued. Held in a ref rather than state
   * because it is not rendered and every mutation must see the latest value
   * immediately -- a stale render would hand out a duplicate number.
   */
  const sequenceRef = useRef<SequenceState | null>(null);
  if (sequenceRef.current === null) {
    const state: SequenceState = {};
    seedCompanies.forEach((company) => {
      const years = new Set<number>();
      const collect = (dates: string[]) => dates.forEach((d) => years.add(new Date(d).getFullYear()));
      collect(seedCollections.filter((c) => c.companyId === company.id).map((c) => c.collectedDate));
      collect(seedSortedBags.filter((b) => b.companyId === company.id).map((b) => b.createdDate));
      collect(seedDispatches.filter((d) => d.companyId === company.id).map((d) => d.sentDate));
      years.add(new Date().getFullYear());

      years.forEach((year) => {
        seedSequence(state, company.id, "COL", year, seedCollections.filter((c) => c.companyId === company.id).map((c) => c.bagNumber));
        seedSequence(state, company.id, "BAG", year, seedSortedBags.filter((b) => b.companyId === company.id).map((b) => b.bagNumber));
        seedSequence(state, company.id, "DSP", year, seedDispatches.filter((d) => d.companyId === company.id).map((d) => d.dispatchNumber));
      });
    });
    sequenceRef.current = state;
  }
  const sequence = sequenceRef.current;

  // Held in a ref so stamping never re-creates every mutation function.
  const actorRef = useRef<string | undefined>(undefined);
  const setActor = useCallback((userId: string | null) => {
    actorRef.current = userId ?? undefined;
  }, []);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    const created: Product = { ...product, id: `p-${Date.now()}` };
    setProducts((prev) => [...prev, created]);
    return created;
  }, []);

  const addDistributor = useCallback((distributor: Omit<Distributor, "id" | "isActive">) => {
    const created: Distributor = { ...distributor, id: `d-${Date.now()}`, isActive: true };
    setDistributors((prev) => [...prev, created]);
    return created;
  }, []);

  const addCollections = useCallback(
    (input: CollectionInput, bagCount: number) => {
      // One pickup usually means several bags from the same party, so the
      // whole batch is numbered in a single pass. Sequences run per
      // company, so Cadbury and Haldirams each keep their own clean run.
      const safeCount = Math.max(1, Math.floor(bagCount));
      const stamp = Date.now();
      const code = companies.find((c) => c.id === input.companyId)?.code ?? "GEN";
      // Numbers come from the forward-only counter, so deleting records can
      // never cause a number to be handed out a second time.
      const numbers = issueCollectionNumbers(code, input.companyId, input.collectedDate, sequence, safeCount);

      const created: CollectionBag[] = Array.from({ length: safeCount }, (_, index) => ({
        // Index is part of the id because Date.now() returns the same
        // value for every bag created inside one loop.
        id: `c-${stamp}-${index}`,
        bagNumber: numbers[index],
        companyId: input.companyId,
        distributorId: input.distributorId,
        collectedDate: input.collectedDate,
        status: "uncounted",
        estimatedPieces: input.estimatedPieces,
        notes: input.notes,
        // One photo usually shows the whole pickup, so every bag carries it.
        photoUrl: input.photoUrl,
        loggedBy: actorRef.current,
      }));

      // Reversed so the highest number ends up at the top of the list,
      // matching the newest-first order of the rest of the page.
      setCollections((prev) => [...created.slice().reverse(), ...prev]);
      return created;
    },
    [companies, sequence]
  );

  const previewCollectionNumbers = useCallback(
    (companyId: string, collectedDate: string, count: number) => {
      const code = companies.find((c) => c.id === companyId)?.code ?? "GEN";
      return peekCollectionNumbers(code, companyId, collectedDate, sequence, Math.max(1, Math.floor(count)));
    },
    [companies, sequence]
  );

  const deleteCollections = useCallback(
    (ids: string[]) => {
      // Goods already sent to the factory cannot be taken back out of a claim.
      const sent = new Set(sortedBags.filter((b) => b.status === "dispatched").map((b) => b.id));
      const allowed = new Set(ids.filter((id) => !countLines.some((l) => l.collectionId === id && l.bagId && sent.has(l.bagId))));
      if (allowed.size === 0) return;
      const rest = countLines.filter((l) => !allowed.has(l.collectionId));
      setCollections((prev) => prev.filter((c) => !allowed.has(c.id)));
      setCountLines(rest);
      // Their pieces come out of the bags they were put in.
      setSortedBags(refreshBags(sortedBags, rest));
    },
    [countLines, sortedBags]
  );

  const saveCount = useCallback(
    (collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => {
      // The bag's company is copied onto every line, so bags can be filled
      // by company without joining back through the collection each time.
      const companyId = collections.find((c) => c.id === collectionId)?.companyId ?? "";
      const old = countLines.filter((l) => l.collectionId === collectionId);
      const sent = new Set(sortedBags.filter((b) => b.status === "dispatched").map((b) => b.id));
      // A count whose goods have gone to the factory is final.
      if (old.some((l) => l.bagId && sent.has(l.bagId))) return false;

      const stamp = Date.now();
      const fresh: CountLine[] = lines
        .filter((line) => line.quantity > 0)
        .map((line, index) => ({
          id: `cl-${stamp}-${index}`,
          collectionId,
          companyId,
          productId: line.productId,
          mrp: line.mrp,
          quantity: line.quantity,
          // The claim rate is fixed at count time, like the MRP.
          rate: products.find((p) => p.id === line.productId)?.claimRate,
          packed: false,
        }));

      // A re-count first takes the old pieces back out of their bags. Bags
      // left empty are kept for a moment, so the new count refills the same
      // numbers that may already be written on the bags.
      const rest = countLines.filter((l) => l.collectionId !== collectionId);
      const emptied = refreshBags(sortedBags, rest, false);
      const { lines: placed, bags } = putIntoBags(fresh, emptied, companies, today(), sequence, collectionId);
      const allLines = [...rest, ...placed];
      const before = new Map(sortedBags.map((b) => [b.id, b.status]));
      const refreshed = refreshBags(bags, allLines).map((b) =>
        // Whoever counted the pieces that filled a bag is the one who closes it.
        b.status === "ready" && before.get(b.id) !== "ready" ? { ...b, tiedBy: actorRef.current } : b
      );

      setCountLines(allLines);
      setSortedBags(refreshed);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId ? { ...c, status: fresh.length ? "packed" : "counted", countedDate: today(), countedBy: actorRef.current } : c
        )
      );
      return true;
    },
    [collections, countLines, sortedBags, products, companies, sequence]
  );

  /**
   * Closes a company's open bags part-filled, so they can go on today's
   * factory run. Returns the bags closed.
   */
  const closeOpenBags = useCallback(
    (companyId: string) => {
      const closing = sortedBags.filter((b) => b.status === "open" && b.companyId === companyId && b.pieceCount > 0);
      if (closing.length === 0) return [];
      const ids = new Set(closing.map((b) => b.id));
      const closed = closing.map((b) => ({ ...b, status: "ready" as const, closedEarly: true, tiedBy: actorRef.current }));
      setSortedBags((prev) => prev.map((b) => (ids.has(b.id) ? closed.find((c) => c.id === b.id)! : b)));
      return closed;
    },
    [sortedBags]
  );

  const deleteSortedBags = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setSortedBags((prev) => prev.filter((b) => !idSet.has(b.id)));
  }, []);

  const createDispatch = useCallback(
    (bagIds: string[]) => {
      const idSet = new Set(bagIds);
      const selected = sortedBags.filter((b) => idSet.has(b.id) && b.status === "ready");
      if (selected.length === 0) return null;

      // A dispatch goes to one company's factory, so refuse to build a
      // mixed one rather than silently creating an unclaimable batch.
      const companyId = selected[0].companyId;
      if (selected.some((b) => b.companyId !== companyId)) return null;

      const code = companies.find((c) => c.id === companyId)?.code ?? "GEN";

      const dispatch: Dispatch = {
        id: `dp-${Date.now()}`,
        dispatchNumber: issueDispatchNumber(code, companyId, today(), sequence),
        companyId,
        sentDate: today(),
        bagCount: selected.length,
        pieceCount: selected.reduce((sum, b) => sum + b.pieceCount, 0),
        claimedValue: Math.round(selected.reduce((sum, b) => sum + bagValue(b), 0) * 100) / 100,
        status: "sent",
        // Fixed now, so each party's account survives the bags later being
        // cleared out once the claim settles.
        partyShares: partySharesForBags(selected, collections, countLines),
        sentBy: actorRef.current,
      };

      setDispatches((prev) => [dispatch, ...prev]);
      setSortedBags((prev) =>
        prev.map((b) => (idSet.has(b.id) && b.status === "ready" ? { ...b, status: "dispatched", dispatchId: dispatch.id } : b))
      );
      return dispatch;
    },
    [sortedBags, collections, countLines, companies, sequence]
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
              settledBy: actorRef.current,
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
    setRecords((prev) => [{ ...record, id: `r-${Date.now()}`, loggedBy: actorRef.current }, ...prev]);
  }, []);

  const deleteRecords = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setRecords((prev) => prev.filter((r) => !idSet.has(r.id)));
  }, []);

  const saveCompany = useCallback((company: Company) => setCompanies((prev) => upsert(prev, company)), []);
  const saveProduct = useCallback((product: Product) => setProducts((prev) => upsert(prev, product)), []);
  const saveDistributor = useCallback((distributor: Distributor) => setDistributors((prev) => upsert(prev, distributor)), []);
  const saveUser = useCallback((user: UserAccount) => setUsers((prev) => upsert(prev, user)), []);
  const updateRecord = useCallback((id: string, patch: Partial<Omit<DamageRecord, "id">>) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      companies,
      distributors,
      products,
      collections,
      countLines,
      sortedBags,
      dispatches,
      records,
      users,
      saveCompany,
      saveProduct,
      saveDistributor,
      saveUser,
      updateRecord,
      setActor,
      addProduct,
      addDistributor,
      addCollections,
      previewCollectionNumbers,
      deleteCollections,
      saveCount,
      closeOpenBags,
      deleteSortedBags,
      createDispatch,
      recordSettlement,
      deleteDispatches,
      addRecord,
      deleteRecords,
    }),
    [
      companies,
      distributors,
      products,
      collections,
      countLines,
      sortedBags,
      dispatches,
      records,
      users,
      saveCompany,
      saveProduct,
      saveDistributor,
      saveUser,
      updateRecord,
      setActor,
      addProduct,
      addDistributor,
      addCollections,
      previewCollectionNumbers,
      deleteCollections,
      saveCount,
      closeOpenBags,
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

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  return rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
