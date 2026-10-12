"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import * as seed from "./seed-data";
import { peekCollectionNumbers } from "./bag-packing";
import { emptyData, type AppData } from "./sync/app-data";
import { CLOUD, CloudAuth, CloudTransport, adminRemoveLogin, adminSetLogin, type CloudSession } from "./sync/cloud";
import { SyncEngine, type KV, type SyncStatus } from "./sync/engine";
import type { CollectionInput, CountInput, OpName } from "./sync/ops";
import { LiveRev } from "./sync/realtime";
import type { CollectionBag, Company, Distributor, CountLine, DamageRecord, Dispatch, Product, SortedBag, UserAccount } from "@/types";

/**
 * The app's data, shared by every page and -- through the database -- by
 * every phone and browser of the business.
 *
 * Every change below is an operation (lib/sync/ops.ts). It shows on this
 * screen at once and is saved in the background; other devices hear about
 * it over Realtime within a second or two. Without internet, changes wait
 * on the phone and are saved when it comes back.
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
  saveCount: (collectionId: string, lines: CountInput) => boolean;
  /** Closes a company's open bags part-filled before a factory run. */
  closeOpenBags: (companyId: string) => SortedBag[];
  deleteSortedBags: (ids: string[]) => void;
  createDispatch: (bagIds: string[]) => Dispatch | null;
  recordSettlement: (dispatchId: string, receivedValue: number) => void;
  deleteDispatches: (ids: string[]) => void;
  /**
   * Logs a godown entry. Own-godown damage counted in pieces goes straight
   * into the numbered claim bags, like a counted pickup.
   */
  addRecord: (record: Omit<DamageRecord, "id">) => DamageRecord;
  /** Deletes entries and takes their pieces back out of the bags (not once sent). */
  deleteRecords: (ids: string[]) => void;
}

export interface SyncValue {
  /** cloud: shared through the database; local: this device only. */
  mode: "cloud" | "local";
  /** False until this device's saved sign-in has been read. */
  checked: boolean;
  /** The login this device is signed in with. */
  account: { email: string } | null;
  status: SyncStatus;
  /** Realtime connected: other devices' changes arrive within seconds. */
  live: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Signs this person out. Changes not yet saved stay on the device and are saved by the next person who signs in. */
  signOut: () => Promise<void>;
  /** The signed-in person's own password. */
  changePassword: (password: string) => Promise<void>;
  /** Admin: add a person's login or set a new password (null keeps it). */
  setLogin: (email: string, password: string | null, isAdmin: boolean) => Promise<void>;
  /** Admin: stop a login from opening FreshTrack. */
  removeLogin: (email: string) => Promise<void>;
  syncNow: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);
const SyncContext = createContext<SyncValue | null>(null);

const seedData: AppData = {
  companies: seed.companies,
  distributors: seed.distributors,
  products: seed.products,
  users: seed.users,
  collections: seed.collectionBags,
  countLines: seed.countLines,
  sortedBags: seed.sortedBags,
  dispatches: seed.dispatches,
  records: seed.records,
  seq: {},
};

function browserStorage(): KV | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const noTimer = {
  setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimer: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** Before sign-in there is nothing to show; screens are not rendered then anyway. */
const idle = new SyncEngine({ transport: null, seed: { ...emptyData() } });

const POLL_MS = 20_000;
const POLL_LIVE_MS = 120_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const mode: SyncValue["mode"] = CLOUD.enabled ? "cloud" : "local";
  const [auth, setAuth] = useState<CloudAuth | null>(null);
  const [session, setSession] = useState<CloudSession | null>(null);
  const [checked, setChecked] = useState(mode === "local");
  const [live, setLive] = useState(false);
  const [engine, setEngine] = useState<SyncEngine>(() => (mode === "local" ? new SyncEngine({ transport: null, seed: seedData }) : idle));

  // Read this device's business sign-in once, in the browser.
  useEffect(() => {
    if (mode !== "cloud") return;
    const a = new CloudAuth(browserStorage());
    setAuth(a);
    setSession(a.session);
    setChecked(true);
    return a.subscribe(() => setSession(a.session));
  }, [mode]);

  // A fresh engine for each sign-in. The data saved on the device belongs to
  // the business, not the person, so the next person carries on from it.
  const loginId = session?.userId ?? "";
  useEffect(() => {
    if (mode !== "cloud" || !auth || !loginId) return;
    const e = new SyncEngine({ transport: new CloudTransport(auth), seed: seedData, storage: browserStorage(), scope: CLOUD.url, ...noTimer });
    setEngine(e);
    e.start();

    const rt = new LiveRev(CLOUD.url, CLOUD.key, () => auth.token().catch(() => null), (rev) => e.remoteRev(rev), setLive);
    rt.start();
    const offAuth = auth.subscribe(() => void rt.refreshToken());

    // Polling backs up Realtime, and catches up after the phone sleeps.
    let ticks = 0;
    const poll = setInterval(() => {
      ticks += 1;
      if (document.visibilityState !== "visible") return;
      if (!rt.live || ticks * POLL_MS >= POLL_LIVE_MS) {
        ticks = 0;
        e.sync();
      }
    }, POLL_MS);
    const wake = () => {
      if (document.visibilityState === "visible") e.sync();
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "freshtrack.pending") e.adoptPendingFrom(ev.newValue);
      if (ev.key === "freshtrack.cloud-session") auth.reloadFromStorage();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("storage", onStorage);
      offAuth();
      rt.stop();
      e.stop();
      setLive(false);
    };
  }, [mode, auth, loginId]);

  // A restored sign-in picks up where it left off.
  useEffect(() => {
    if (session?.accessToken && engine.getState().status.error === "auth") engine.sync();
  }, [session?.accessToken, engine]);

  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);
  const view = state.view;

  // Held in a ref so stamping never re-creates every mutation function.
  const actorRef = useRef<string | undefined>(undefined);
  const setActor = useCallback((userId: string | null) => {
    actorRef.current = userId ?? undefined;
  }, []);

  const engineRef = useRef(engine);
  engineRef.current = engine;
  const op = useCallback(<R,>(name: OpName, ...args: unknown[]) => engineRef.current.run(name, args, actorRef.current) as R, []);

  const mutations = useMemo(
    () => ({
      saveCompany: (company: Company) => op<void>("saveCompany", company),
      saveProduct: (product: Product) => op<void>("saveProduct", product),
      saveDistributor: (distributor: Distributor) => op<void>("saveDistributor", distributor),
      saveUser: (user: UserAccount) => op<void>("saveUser", user),
      updateRecord: (id: string, patch: Partial<Omit<DamageRecord, "id">>) => op<void>("updateRecord", id, patch),
      addProduct: (product: Omit<Product, "id">) => op<Product>("addProduct", product),
      addDistributor: (distributor: Omit<Distributor, "id" | "isActive">) => op<Distributor>("addDistributor", distributor),
      addCollections: (input: CollectionInput, bagCount: number) => op<CollectionBag[]>("addCollections", input, bagCount),
      deleteCollections: (ids: string[]) => op<void>("deleteCollections", ids),
      saveCount: (collectionId: string, lines: CountInput) => op<boolean>("saveCount", collectionId, lines),
      closeOpenBags: (companyId: string) => op<SortedBag[]>("closeOpenBags", companyId),
      deleteSortedBags: (ids: string[]) => op<void>("deleteSortedBags", ids),
      createDispatch: (bagIds: string[]) => op<Dispatch | null>("createDispatch", bagIds),
      recordSettlement: (dispatchId: string, receivedValue: number) => op<void>("recordSettlement", dispatchId, receivedValue),
      deleteDispatches: (ids: string[]) => op<void>("deleteDispatches", ids),
      addRecord: (record: Omit<DamageRecord, "id">) => op<DamageRecord>("addRecord", record),
      deleteRecords: (ids: string[]) => op<void>("deleteRecords", ids),
      previewCollectionNumbers: (companyId: string, collectedDate: string, count: number) => {
        const data = engineRef.current.getState().view;
        const code = data.companies.find((c) => c.id === companyId)?.code ?? "GEN";
        return peekCollectionNumbers(code, companyId, collectedDate, data.seq, Math.max(1, Math.floor(count)));
      },
    }),
    [op]
  );

  const value = useMemo<StoreValue>(
    () => ({
      companies: view.companies,
      distributors: view.distributors,
      products: view.products,
      collections: view.collections,
      countLines: view.countLines,
      sortedBags: view.sortedBags,
      dispatches: view.dispatches,
      records: view.records,
      users: view.users,
      setActor,
      ...mutations,
    }),
    [view, setActor, mutations]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!auth) return;
      await auth.signIn(email, password);
    },
    [auth]
  );

  const signOut = useCallback(async () => {
    engineRef.current.stop();
    await auth?.signOut();
    setEngine(idle);
  }, [auth]);

  const changePassword = useCallback(async (password: string) => {
    await auth?.changePassword(password);
  }, [auth]);

  const setLogin = useCallback(
    async (email: string, password: string | null, isAdmin: boolean) => {
      if (auth) await adminSetLogin(auth, email, password, isAdmin);
    },
    [auth]
  );

  const removeLogin = useCallback(
    async (email: string) => {
      if (auth) await adminRemoveLogin(auth, email);
    },
    [auth]
  );

  const syncNow = useCallback(() => engineRef.current.sync(), []);

  // Signed in but the engine is not running yet: still loading.
  const waiting = mode === "cloud" && engine === idle;
  const status = useMemo(() => (waiting ? { ...state.status, phase: "loading" as const } : state.status), [waiting, state.status]);

  const sync = useMemo<SyncValue>(
    () => ({
      mode,
      checked,
      account: session ? { email: session.email } : null,
      status,
      live,
      signIn,
      signOut,
      changePassword,
      setLogin,
      removeLogin,
      syncNow,
    }),
    [mode, checked, session, status, live, signIn, signOut, changePassword, setLogin, removeLogin, syncNow]
  );

  return (
    <SyncContext.Provider value={sync}>
      <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
    </SyncContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used inside StoreProvider");
  return context;
}
