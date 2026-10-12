import type { Row } from "./app-data";
import { SyncError, type KV, type Transport } from "./engine";

/**
 * The FreshTrack database (Supabase project "Damage_Record"). The URL and
 * the anon key are public by design -- every browser that opens the app
 * gets them -- so they can live in the code. What protects the data is the
 * business login: the database only answers signed-in members.
 */
const DEFAULT_URL = "https://tzcfiddmdvxqsfcuvopc.supabase.co";
const DEFAULT_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6Y2ZpZGRtZHZ4cXNmY3V2b3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mjc4MDYsImV4cCI6MjEwNDAwMzgwNn0.QPxws5McdkKJcdlCjYzKVhf48W86Y-TwS8fAXVX5XVE";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const CLOUD = {
  url: /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(envUrl) ? envUrl : DEFAULT_URL,
  key: envKey.length > 30 ? envKey : DEFAULT_KEY,
  /** NEXT_PUBLIC_FRESHTRACK_LOCAL=1 keeps everything on the device (demos). */
  enabled: process.env.NEXT_PUBLIC_FRESHTRACK_LOCAL !== "1",
};

/* ------------------------------------------------------------------ */
/* Business login                                                       */
/* ------------------------------------------------------------------ */

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  userId: string;
  email: string;
}

const SESSION_KEY = "freshtrack.cloud-session";

async function call(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { apikey: CLOUD.key, "Content-Type": "application/json" };
  headers.Authorization = `Bearer ${init.token ?? CLOUD.key}`;
  try {
    return await fetch(`${CLOUD.url}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) }, cache: "no-store" });
  } catch {
    throw new SyncError("network", "no internet");
  }
}

function toSession(body: { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user?: { id: string; email?: string } }): CloudSession {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
    userId: body.user?.id ?? "",
    email: body.user?.email ?? "",
  };
}

/**
 * The phone's sign-in to the database, done once by the owner. Tokens are
 * refreshed before they run out; every tab of the browser shares them.
 */
export class CloudAuth {
  session: CloudSession | null = null;
  private refreshing: Promise<CloudSession | null> | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly storage: KV | null) {
    this.session = this.stored();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(session: CloudSession | null) {
    this.session = session;
    try {
      if (session) this.storage?.setItem(SESSION_KEY, JSON.stringify(session));
      else this.storage?.removeItem(SESSION_KEY);
    } catch {
      /* not remembered: sign in again next visit */
    }
    this.listeners.forEach((fn) => fn());
  }

  private stored(): CloudSession | null {
    try {
      const raw = this.storage?.getItem(SESSION_KEY);
      const s = raw ? (JSON.parse(raw) as CloudSession) : null;
      return s?.accessToken && s.refreshToken ? s : null;
    } catch {
      return null;
    }
  }

  /** Another tab signed in, out, or refreshed the tokens. */
  reloadFromStorage() {
    const s = this.stored();
    if (s?.accessToken !== this.session?.accessToken) {
      this.session = s;
      this.listeners.forEach((fn) => fn());
    }
  }

  async signIn(email: string, password: string): Promise<CloudSession> {
    const res = await call("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
    if (res.status === 400 || res.status === 401 || res.status === 422) throw new SyncError("auth", "wrong email or password");
    if (!res.ok) throw new SyncError("server", `sign-in failed (${res.status})`);
    const session = toSession(await res.json());
    this.set(session);
    return session;
  }

  /** A valid access token, refreshed if it is about to run out; null when signed out. */
  async token(): Promise<string | null> {
    // Another tab may have refreshed already.
    const stored = this.stored();
    if (stored && this.session && stored.userId === this.session.userId && stored.expiresAt > this.session.expiresAt) this.session = stored;
    const s = this.session;
    if (!s) return null;
    if (s.expiresAt - Date.now() / 1000 > 90) return s.accessToken;
    return (await this.refresh())?.accessToken ?? null;
  }

  refresh(): Promise<CloudSession | null> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<CloudSession | null> {
    const s = this.session;
    if (!s) return null;
    const res = await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: s.refreshToken }) });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      // Refresh token no longer valid (password changed, or signed out elsewhere).
      // Another tab may have just rotated it -- use theirs if so.
      const stored = this.stored();
      if (stored && stored.refreshToken !== s.refreshToken && stored.expiresAt - Date.now() / 1000 > 90) {
        this.session = stored;
        return stored;
      }
      this.set(null);
      throw new SyncError("auth", "signed out");
    }
    if (!res.ok) throw new SyncError("server", `refresh failed (${res.status})`);
    const next = toSession(await res.json());
    this.set({ ...next, email: next.email || s.email, userId: next.userId || s.userId });
    return this.session;
  }

  async changePassword(password: string) {
    const token = await this.token();
    if (!token) throw new SyncError("auth", "signed out");
    const res = await call("/auth/v1/user", { method: "PUT", token, body: JSON.stringify({ password }) });
    if (res.status === 422) throw new SyncError("server", "password too weak");
    if (!res.ok) throw new SyncError(res.status === 401 ? "auth" : "server", `password change failed (${res.status})`);
  }

  async signOut() {
    const token = this.session?.accessToken;
    this.set(null);
    if (token) {
      try {
        await call("/auth/v1/logout?scope=local", { method: "POST", token });
      } catch {
        /* signed out on this phone anyway */
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Database calls                                                       */
/* ------------------------------------------------------------------ */

async function errorOf(res: Response): Promise<SyncError> {
  let body: { code?: string; message?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  if (res.status === 401 || body.code === "PGRST301" || body.code === "PGRST303") return new SyncError("auth", body.message ?? "not signed in");
  if (res.status === 403 || body.code === "42501") return new SyncError("forbidden", body.message ?? "no access");
  if (res.status === 404 || body.code === "PGRST202" || body.code === "42P01") return new SyncError("setup", body.message ?? "database not set up");
  if (body.code === "22023") return new SyncError("invalid", body.message ?? "not accepted");
  return new SyncError("server", body.message ?? `error ${res.status}`);
}

/** Calls a database function as the signed-in person; an expired token is refreshed once. */
export async function rpc<T>(auth: CloudAuth, fn: string, args: object): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await auth.token();
    if (!token) throw new SyncError("auth", "not signed in");
    const res = await call(`/rest/v1/rpc/${fn}`, { method: "POST", token, body: JSON.stringify(args) });
    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    }
    const err = await errorOf(res);
    if (err.kind === "auth" && attempt === 0) {
      await auth.refresh();
      continue;
    }
    throw err;
  }
  throw new SyncError("auth", "not signed in");
}

export class CloudTransport implements Transport {
  constructor(private readonly auth: CloudAuth) {}

  pull(since: number) {
    return rpc<{ rev: number; rows: Row[] }>(this.auth, "ft_pull", { since });
  }

  commit(baseRev: number, changes: Row[], opIds: string[], actor?: string) {
    return rpc<{ ok: boolean; rev: number; applied?: string[] }>(this.auth, "ft_commit", { base_rev: baseRev, changes, op_ids: opIds, actor: actor ?? null });
  }
}

/* ------------------------------------------------------------------ */
/* Logins (admin only; the database checks)                             */
/* ------------------------------------------------------------------ */

/** Adds a person's login, or gives it a new password (null keeps the old one). */
export function adminSetLogin(auth: CloudAuth, email: string, password: string | null, isAdmin: boolean) {
  return rpc<null>(auth, "ft_admin_set_login", { login_email: email.trim().toLowerCase(), login_password: password, is_admin: isAdmin });
}

/** Stops a login from opening FreshTrack and signs it out everywhere. */
export function adminRemoveLogin(auth: CloudAuth, email: string) {
  return rpc<null>(auth, "ft_admin_remove_login", { login_email: email.trim().toLowerCase() });
}
