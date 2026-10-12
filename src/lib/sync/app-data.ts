import type { SequenceState } from "../bag-packing";
import type { CollectionBag, Company, CountLine, DamageRecord, Dispatch, Distributor, Product, SortedBag, UserAccount } from "@/types";

/**
 * Everything the app knows, in one plain object. Operations (ops.ts) turn
 * one AppData into the next; the sync engine stores each record as one
 * database row and sends only the records that changed.
 */
export interface AppData {
  companies: Company[];
  distributors: Distributor[];
  products: Product[];
  users: UserAccount[];
  collections: CollectionBag[];
  countLines: CountLine[];
  sortedBags: SortedBag[];
  dispatches: Dispatch[];
  records: DamageRecord[];
  /** Forward-only numbering counters: `<companyId>:<COL|BAG|DSP>:<year>` → last number issued. */
  seq: SequenceState;
}

export const LIST_KINDS = ["companies", "distributors", "products", "users", "collections", "countLines", "sortedBags", "dispatches", "records"] as const;
export type ListKind = (typeof LIST_KINDS)[number];
export type RowKind = ListKind | "seq";

/** One record as stored in the database. */
export interface Row {
  kind: RowKind;
  id: string;
  data: unknown;
  deleted?: boolean;
}

export function emptyData(): AppData {
  return { companies: [], distributors: [], products: [], users: [], collections: [], countLines: [], sortedBags: [], dispatches: [], records: [], seq: {} };
}

/* ------------------------------------------------------------------ */
/* Order                                                               */
/* ------------------------------------------------------------------ */

/**
 * Lists keep one fixed order whatever order their rows arrived in, so two
 * phones always show the same list. Pickups, dispatches and godown entries
 * are newest first: their ids start with a time stamp that sorts.
 * Master data keeps the order of the built-in lists, new rows after.
 */
const NEWEST_FIRST: ReadonlySet<ListKind> = new Set(["collections", "dispatches", "records"]);

export function makeOrder(seed: AppData) {
  const rank = new Map<string, number>();
  (["companies", "distributors", "products", "users"] as const).forEach((kind) => seed[kind].forEach((row, i) => rank.set(`${kind}:${row.id}`, i)));
  return function order<K extends ListKind>(kind: K, rows: AppData[K]): AppData[K] {
    const list = [...rows] as { id: string }[];
    if (NEWEST_FIRST.has(kind)) {
      list.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    } else if (kind === "companies" || kind === "distributors" || kind === "products" || kind === "users") {
      const r = (id: string) => rank.get(`${kind}:${id}`) ?? Number.MAX_SAFE_INTEGER;
      // Rows not in the built-in lists keep their relative order (stable sort).
      list.sort((a, b) => r(a.id) - r(b.id));
    }
    return list as AppData[K];
  };
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

/** Every record of `data` as a row, for seeding an empty database. */
export function toRows(data: AppData): Row[] {
  const rows: Row[] = [];
  LIST_KINDS.forEach((kind) => (data[kind] as { id: string }[]).forEach((r) => rows.push({ kind, id: r.id, data: r })));
  Object.entries(data.seq).forEach(([id, n]) => rows.push({ kind: "seq", id, data: { n } }));
  return rows;
}

/** The rows that turn `before` into `after`: changed or new records, and deletions. */
export function diff(before: AppData, after: AppData): Row[] {
  const rows: Row[] = [];
  LIST_KINDS.forEach((kind) => {
    const a = before[kind] as { id: string }[];
    const b = after[kind] as { id: string }[];
    if (a === b) return;
    const old = new Map(a.map((r) => [r.id, r]));
    const seen = new Set<string>();
    b.forEach((r) => {
      seen.add(r.id);
      const prev = old.get(r.id);
      if (prev !== r && !same(prev, r)) rows.push({ kind, id: r.id, data: r });
    });
    old.forEach((_, id) => {
      if (!seen.has(id)) rows.push({ kind, id, data: null, deleted: true });
    });
  });
  if (before.seq !== after.seq) {
    Object.entries(after.seq).forEach(([id, n]) => {
      if (before.seq[id] !== n) rows.push({ kind: "seq", id, data: { n } });
    });
  }
  return rows;
}

/** Applies database rows on top of `data`, returning a new AppData. */
export function applyRows(data: AppData, rows: Row[], order: ReturnType<typeof makeOrder>): AppData {
  if (rows.length === 0) return data;
  const next: AppData = { ...data };
  const touched = new Set<ListKind>();
  const maps = new Map<ListKind, Map<string, { id: string }>>();
  const mapOf = (kind: ListKind) => {
    let m = maps.get(kind);
    if (!m) {
      m = new Map((data[kind] as { id: string }[]).map((r) => [r.id, r]));
      maps.set(kind, m);
    }
    return m;
  };

  rows.forEach((row) => {
    if (row.kind === "seq") {
      if (next.seq === data.seq) next.seq = { ...data.seq };
      if (row.deleted) delete next.seq[row.id];
      else next.seq[row.id] = Number((row.data as { n?: number } | null)?.n) || 0;
      return;
    }
    if (!(LIST_KINDS as readonly string[]).includes(row.kind)) return;
    const m = mapOf(row.kind);
    touched.add(row.kind);
    if (row.deleted || row.data == null) {
      m.delete(row.id);
      return;
    }
    const incoming = { ...(row.data as object), id: row.id } as { id: string };
    // Unchanged records keep their object, so screens showing them do not redraw.
    if (!same(m.get(row.id), incoming)) m.set(row.id, incoming);
  });

  touched.forEach((kind) => {
    (next as unknown as Record<ListKind, unknown>)[kind] = order(kind, Array.from(mapOf(kind).values()) as AppData[typeof kind]);
  });
  return next;
}

/** Puts every list in its fixed order (after an operation). */
export function ordered(data: AppData, order: ReturnType<typeof makeOrder>): AppData {
  const next = { ...data };
  LIST_KINDS.forEach((kind) => {
    (next as unknown as Record<ListKind, unknown>)[kind] = order(kind, data[kind]);
  });
  return next;
}

/** Deep equality for plain JSON values; undefined fields count as missing. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => same(v, b[i]));
  }
  if (Array.isArray(b)) return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (ao[k] === undefined && bo[k] === undefined) continue;
    if (!same(ao[k], bo[k])) return false;
  }
  return true;
}
