import { today } from "../utils";
import { applyRows, diff, emptyData, makeOrder, ordered, type AppData, type Row } from "./app-data";
import { runOp, type OpName, type PendingOp } from "./ops";

/**
 * Keeps this phone's copy of the data in step with the shared database.
 *
 * - `base` is what the database had at revision `rev`, as far as we know.
 * - `pending` are changes made here and not yet saved, in order.
 * - The screens see base + pending, so a change shows up the moment it is
 *   made, with or without internet.
 *
 * Saving sends pending changes as one batch, accepted only if nobody saved
 * in between. If someone did, we pull what they saved and redo our pending
 * changes on top of it (each change is a pure operation, so redoing it is
 * safe) and send again. A change resent after a dropped connection is
 * recognised by its id and not applied twice.
 */

export interface Transport {
  pull(since: number): Promise<{ rev: number; rows: Row[] }>;
  commit(baseRev: number, changes: Row[], opIds: string[], actor?: string): Promise<{ ok: boolean; rev: number; applied?: string[] }>;
}

export type SyncErrorKind = "network" | "auth" | "forbidden" | "setup" | "server" | "invalid";

export class SyncError extends Error {
  constructor(public kind: SyncErrorKind, message: string) {
    super(message);
  }
}

export interface SyncStatus {
  /** loading: nothing to show yet; ready: data on screen; error: nothing on screen and it failed. */
  phase: "loading" | "ready" | "error";
  /** Changes made on this device that the database does not have yet. */
  pending: number;
  /** A save or pull is going on right now. */
  busy: boolean;
  /** The last attempt reached the database. */
  online: boolean;
  /** What is stopping saves, if anything. */
  error?: SyncErrorKind;
  /** When this device last heard from the database (ms). */
  lastSyncedAt?: number;
}

/** Just enough of localStorage. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface EngineOptions {
  /** null: no database, everything stays on this device (demo and tests). */
  transport: Transport | null;
  /** What a brand-new install starts with (local mode), and the list order. */
  seed: AppData;
  storage?: KV | null;
  /** Storage key prefix. */
  prefix?: string;
  /** Whose data this is (the business account); cached data of another account is ignored. */
  scope?: string;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const MAX_BATCH = 40;
const MAX_ROUNDS = 12;
const BACKOFF = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000];

let counter = 0;
/** Unique, time-ordered stamp: base-36 time, a per-tab counter and a random tail. */
export function makeStamp(now = Date.now()): string {
  counter = (counter + 1) % 1296;
  const rand = Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
  return `${now.toString(36)}${counter.toString(36).padStart(2, "0")}${rand}`;
}

export class SyncEngine {
  private base: AppData;
  private rev = 0;
  private pending: PendingOp[] = [];
  private view: AppData;
  private readonly order: ReturnType<typeof makeOrder>;
  /** Op ids known to be in the database; never resent, never re-adopted from another tab. */
  private readonly committed = new Set<string>();
  private state: { view: AppData; status: SyncStatus };
  private listeners = new Set<() => void>();
  private running = false;
  private wantPull = false;
  private stopped = false;
  private attempt = 0;
  private retryTimer: unknown = null;
  private snapshotTimer: unknown = null;
  private status: SyncStatus;
  private hasData: boolean;

  constructor(private readonly o: EngineOptions) {
    this.order = makeOrder(o.seed);
    const local = !o.transport;
    this.base = local ? ordered(o.seed, this.order) : emptyData();
    this.view = this.base;
    this.hasData = local;
    this.status = { phase: local ? "ready" : "loading", pending: 0, busy: false, online: true };
    this.state = { view: this.view, status: this.status };
  }

  /* ---------------------------- reading ---------------------------- */

  getState = () => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit() {
    this.status = { ...this.status, pending: this.pending.length };
    this.state = { view: this.view, status: this.status };
    this.listeners.forEach((fn) => fn());
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.emit();
  }

  /* ---------------------------- changing --------------------------- */

  private apply(d: AppData, op: PendingOp): [AppData, unknown] {
    const [next, result] = runOp(d, op);
    return [next === d ? d : ordered(next, this.order), result];
  }

  /**
   * Makes a change now and queues it for saving. Returns the operation's
   * result as of this device's current data.
   */
  run(name: OpName, args: unknown[], actor?: string): unknown {
    const stamp = makeStamp(this.now());
    const op: PendingOp = { id: `op-${stamp}`, name, args, env: { stamp, today: today(), actor } };
    const [next, result] = this.apply(this.view, op);
    if (!this.o.transport) {
      // No database: the change is simply the new state.
      this.base = next;
      this.view = next;
      this.emit();
      return result;
    }
    this.view = next;
    this.pending.push(op);
    this.savePending();
    this.emit();
    this.kick();
    return result;
  }

  /** Recomputes what the screens see: base plus every pending change. */
  private rebuild() {
    this.view = this.pending.reduce((d, op) => this.apply(d, op)[0], this.base);
  }

  /* ---------------------------- syncing ---------------------------- */

  /** Loads what this device saved last time, then catches up with the database. */
  start() {
    if (!this.o.transport) return;
    const snap = this.read<{ scope?: string; rev: number; data: AppData }>("snapshot");
    if (snap && snap.scope === this.o.scope && snap.data && typeof snap.rev === "number") {
      this.base = ordered({ ...emptyData(), ...snap.data }, this.order);
      this.rev = snap.rev;
      this.hasData = true;
    }
    this.absorb(this.read<{ scope?: string; ops: PendingOp[] }>("pending"));
    this.rebuild();
    this.status = { ...this.status, phase: this.hasData ? "ready" : "loading" };
    this.emit();
    this.sync();
  }

  stop() {
    this.stopped = true;
    if (this.retryTimer) this.o.clearTimer?.(this.retryTimer);
    this.flushSnapshot();
  }

  /** Pull now and save anything pending (on focus, coming online, a Realtime ping). */
  sync() {
    this.wantPull = true;
    this.kick();
  }

  /** Another device saved revision `rev`: pull if we do not have it. */
  remoteRev(rev?: number) {
    if (rev !== undefined && rev <= this.rev) return;
    this.sync();
  }

  /** Changes waiting in another tab of this browser (storage event). */
  adoptPendingFrom(raw: string | null) {
    if (!raw) return;
    try {
      if (this.absorb(JSON.parse(raw))) {
        this.rebuild();
        this.emit();
        this.kick();
      }
    } catch {
      /* ignore a half-written value */
    }
  }

  private absorb(stored: { scope?: string; ops: PendingOp[] } | null): boolean {
    if (!stored || stored.scope !== this.o.scope || !Array.isArray(stored.ops)) return false;
    const have = new Set(this.pending.map((op) => op.id));
    const fresh = stored.ops.filter((op) => op && op.id && !have.has(op.id) && !this.committed.has(op.id));
    if (fresh.length === 0) return false;
    this.pending = [...this.pending, ...fresh].sort((a, b) => (a.env.stamp < b.env.stamp ? -1 : a.env.stamp > b.env.stamp ? 1 : 0));
    return true;
  }

  private kick() {
    if (this.running || this.stopped || !this.o.transport) return;
    if (this.retryTimer) {
      this.o.clearTimer?.(this.retryTimer);
      this.retryTimer = null;
    }
    void this.pump();
  }

  private async pump() {
    this.running = true;
    this.setStatus({ busy: true });
    try {
      let rounds = 0;
      while (!this.stopped && (this.wantPull || this.pending.length > 0)) {
        if (++rounds > MAX_ROUNDS) throw new SyncError("server", "too many retries");
        if (this.wantPull || !this.hasData) {
          this.wantPull = false;
          await this.pull();
          continue;
        }
        await this.commit();
      }
      this.attempt = 0;
      this.setStatus({ online: true, error: undefined, lastSyncedAt: this.now(), phase: "ready" });
    } catch (e) {
      const kind: SyncErrorKind = e instanceof SyncError ? e.kind : "network";
      this.status = { ...this.status, online: kind !== "network", error: kind, phase: this.hasData ? "ready" : "error" };
      // A sign-in problem waits for the person to sign in again.
      if (kind !== "auth") {
        // Network trouble and busy moments retry soon; a setup problem only once a minute.
        const delay = kind === "network" || kind === "server" ? BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)] : 60_000;
        this.attempt += 1;
        this.wantPull = true;
        this.retryTimer = this.o.setTimer?.(() => {
          this.retryTimer = null;
          this.kick();
        }, delay);
      }
    } finally {
      this.running = false;
      this.setStatus({ busy: false });
    }
  }

  private async pull() {
    const transport = this.o.transport!;
    let res = await transport.pull(this.rev);
    if (res.rev < this.rev) {
      // The database is behind what we had: it was reset. Start over from it.
      this.base = emptyData();
      this.rev = 0;
      res = await transport.pull(0);
    }
    this.base = applyRows(this.base, res.rows, this.order);
    this.rev = res.rev;
    this.hasData = true;
    if (this.rev === 0 && this.base.companies.length === 0 && !this.pending.some((op) => op.name === "seed")) {
      // A brand-new database: put the companies, products, parties and users in.
      const stamp = makeStamp(this.now());
      this.pending.unshift({ id: "seed-v1", name: "seed", args: [], env: { stamp, today: today() } });
      this.savePending();
    }
    this.rebuild();
    this.status = { ...this.status, phase: "ready", lastSyncedAt: this.now(), online: true };
    this.emit();
    this.scheduleSnapshot();
  }

  private async commit() {
    const transport = this.o.transport!;
    const batch = this.pending.slice(0, MAX_BATCH);
    let next = this.base;
    batch.forEach((op) => {
      next = this.apply(next, op)[0];
    });
    const changes = diff(this.base, next);
    const actor = batch[batch.length - 1]?.env.actor;
    const res = await transport.commit(this.rev, changes, batch.map((op) => op.id), actor);

    if (res.ok) {
      batch.forEach((op) => this.committed.add(op.id));
      const done = new Set(batch.map((op) => op.id));
      this.pending = this.pending.filter((op) => !done.has(op.id));
      if (changes.length > 0) {
        this.base = next;
        this.rev = res.rev;
      } else if (res.rev !== this.rev) {
        this.wantPull = true;
      }
      this.savePending();
      this.rebuild();
      this.emit();
      this.scheduleSnapshot();
      return;
    }

    if (res.applied?.length) {
      // Saved before, but the answer never reached us. Drop them; the pull brings them.
      const done = new Set(res.applied);
      res.applied.forEach((id) => this.committed.add(id));
      this.pending = this.pending.filter((op) => !done.has(op.id));
      this.savePending();
    }
    this.wantPull = true;
  }

  /* ---------------------------- storage ---------------------------- */

  private key(name: string) {
    return `${this.o.prefix ?? "freshtrack"}.${name}`;
  }

  private read<T>(name: string): T | null {
    try {
      const raw = this.o.storage?.getItem(this.key(name));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(name: string, value: unknown) {
    try {
      this.o.storage?.setItem(this.key(name), JSON.stringify(value));
    } catch {
      /* storage full or blocked: still works while the page is open */
    }
  }

  /** Pending changes are written at once: they are the only copy until saved. */
  private savePending() {
    // Keep changes another tab of this browser left here.
    const stored = this.read<{ scope?: string; ops: PendingOp[] }>("pending");
    const own = new Set(this.pending.map((op) => op.id));
    const others =
      stored && stored.scope === this.o.scope && Array.isArray(stored.ops) ? stored.ops.filter((op) => !own.has(op.id) && !this.committed.has(op.id)) : [];
    const ops = [...this.pending, ...others];
    if (ops.length === 0) this.o.storage?.removeItem(this.key("pending"));
    else this.write("pending", { scope: this.o.scope, ops });
  }

  private scheduleSnapshot() {
    if (!this.o.storage || this.snapshotTimer) return;
    this.snapshotTimer = this.o.setTimer?.(() => {
      this.snapshotTimer = null;
      this.flushSnapshot();
    }, 1_500);
  }

  private flushSnapshot() {
    if (!this.o.transport || !this.hasData) return;
    this.write("snapshot", { scope: this.o.scope, rev: this.rev, data: this.base });
  }

  /** Forgets everything stored on this device (signing the device out). */
  clearStorage() {
    this.o.storage?.removeItem(this.key("snapshot"));
    this.o.storage?.removeItem(this.key("pending"));
  }

  private now() {
    return (this.o.now ?? Date.now)();
  }
}
