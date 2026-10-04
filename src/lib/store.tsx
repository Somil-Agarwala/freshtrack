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
} from "./mock-data";
import {
  BAG_CAPACITY,
  buildMrpTiers,
  fillBagContents,
  issueCollectionNumbers,
  issueDispatchNumber,
  peekCollectionNumbers,
  packTiersIntoBags,
  seedSequence,
  type SequenceState,
} from "./bag-packing";
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
  deleteCollections: (ids: string[]) => void;
  saveCount: (collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => void;
  packPendingForCompany: (companyId: string) => PackResult;
  packPendingLines: () => PackResult;
  /**
   * Ties only the FULL bags of a company's piles (optionally just some MRP
   * tiers), leaving the part-filled remainder loose in the pile so the
   * next counted bag can top it up. Returns the bags it created.
   */
  tieFullBags: (companyId: string, mrps?: number[]) => SortedBag[];
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

interface PackResult {
  bagCount: number;
  pieceCount: number;
  bags: SortedBag[];
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

  const deleteCollections = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setCollections((prev) => prev.filter((c) => !idSet.has(c.id)));
    setCountLines((prev) => prev.filter((l) => !idSet.has(l.collectionId)));
  }, []);

  const saveCount = useCallback(
    (collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => {
      // The bag's company is copied onto every line, so packing can group
      // by company without joining back through the collection each time.
      const companyId = collections.find((c) => c.id === collectionId)?.companyId ?? "";
      setCountLines((prev) => {
        const withoutOld = prev.filter((l) => l.collectionId !== collectionId);
        const created: CountLine[] = lines.map((line, index) => ({
          id: `cl-${Date.now()}-${index}`,
          collectionId,
          companyId,
          productId: line.productId,
          mrp: line.mrp,
          quantity: line.quantity,
          packed: false,
        }));
        return [...withoutOld, ...created];
      });
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? { ...c, status: "counted", countedDate: today(), countedBy: actorRef.current } : c))
      );
    },
    [collections]
  );

  // Shared by "pack everything" and "pack one company". Passing a filter
  // keeps the two paths identical apart from which lines they consider,
  // so they cannot drift apart.
  const packLines = useCallback(
    (matches: (line: CountLine) => boolean) => {
      const eligible = countLines.filter((l) => !l.packed && matches(l));
      if (eligible.length === 0) return { bagCount: 0, pieceCount: 0, bags: [] };

      const tiers = buildMrpTiers(eligible);
      const collectedOn = new Map(collections.map((c) => [c.id, c.collectedDate]));
      const created = fillBagContents(packTiersIntoBags(tiers, companies, today(), sequence), eligible, collectedOn).map((b) => ({ ...b, tiedBy: actorRef.current }));
      const eligibleIds = new Set(eligible.map((l) => l.id));
      const touchedCollectionIds = new Set(eligible.map((l) => l.collectionId));

      setSortedBags((prev) => [...prev, ...created]);
      setCountLines((prev) => prev.map((l) => (eligibleIds.has(l.id) ? { ...l, packed: true } : l)));
      // A collection only becomes "packed" once none of its lines remain
      // unpacked -- packing one company must not mark a bag finished.
      setCollections((prev) =>
        prev.map((c) => {
          if (!touchedCollectionIds.has(c.id)) return c;
          const stillPending = countLines.some((l) => l.collectionId === c.id && !l.packed && !eligibleIds.has(l.id));
          return stillPending ? c : { ...c, status: "packed" };
        })
      );

      return {
        bagCount: created.length,
        pieceCount: created.reduce((sum, b) => sum + b.pieceCount, 0),
        bags: created,
      };
    },
    [countLines, collections, companies, sequence]
  );

  const tieFullBags = useCallback(
    (companyId: string, mrps?: number[]) => {
      const inScope = (l: CountLine) => !l.packed && l.companyId === companyId && (!mrps || mrps.includes(l.mrp));
      const tiers = buildMrpTiers(countLines.filter(inScope)).filter((tier) => tier.fullBags > 0);
      if (tiers.length === 0) return [];

      // Oldest pickups go into bags first, so pieces never sit in a pile
      // for weeks while newer ones keep getting tied.
      const collectedOn = new Map(collections.map((c) => [c.id, c.collectedDate]));
      const stamp = Date.now();
      let nextLines = countLines;
      const created: SortedBag[] = [];
      const packedParts: CountLine[] = [];

      tiers.forEach((tier) => {
        let toTake = tier.fullBags * BAG_CAPACITY;
        const sources = new Set<string>();
        const replaced = new Map<string, CountLine[]>();
        nextLines
          .filter((l) => inScope(l) && l.mrp === tier.mrp)
          .sort((a, b) => (collectedOn.get(a.collectionId) ?? "").localeCompare(collectedOn.get(b.collectionId) ?? "") || a.id.localeCompare(b.id))
          .forEach((line) => {
            if (toTake <= 0) return;
            sources.add(line.collectionId);
            if (line.quantity <= toTake) {
              const packed = { ...line, packed: true };
              replaced.set(line.id, [packed]);
              packedParts.push(packed);
              toTake -= line.quantity;
            } else {
              // The bag fills part-way through this line: split it, so the
              // packed part and the loose remainder stay separately counted.
              const packed = { ...line, id: `${line.id}-t${stamp}`, quantity: toTake, packed: true };
              replaced.set(line.id, [packed, { ...line, quantity: line.quantity - toTake }]);
              packedParts.push(packed);
              toTake = 0;
            }
          });
        nextLines = nextLines.flatMap((l) => replaced.get(l.id) ?? [l]);

        const pieces = tier.fullBags * BAG_CAPACITY;
        created.push(
          ...packTiersIntoBags(
            [{ ...tier, pieces, remainder: 0, totalBags: tier.fullBags, value: pieces * tier.mrp, sourceCollectionIds: Array.from(sources) }],
            companies,
            today(),
            sequence
          )
        );
      });

      const filled = fillBagContents(created, packedParts, collectedOn).map((b) => ({ ...b, tiedBy: actorRef.current }));
      setCountLines(nextLines);
      setSortedBags((prev) => [...prev, ...filled]);
      setCollections((prev) =>
        prev.map((c) => {
          if (c.status !== "counted") return c;
          return nextLines.some((l) => l.collectionId === c.id && !l.packed) ? c : { ...c, status: "packed" };
        })
      );
      return filled;
    },
    [countLines, collections, companies, sequence]
  );

  const packPendingLines = useCallback(() => packLines(() => true), [packLines]);

  const packPendingForCompany = useCallback(
    (companyId: string) => packLines((line) => line.companyId === companyId),
    [packLines]
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
        claimedValue: selected.reduce((sum, b) => sum + b.pieceCount * b.mrp, 0),
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
      packPendingLines,
      packPendingForCompany,
      tieFullBags,
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
      packPendingLines,
      packPendingForCompany,
      tieFullBags,
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
