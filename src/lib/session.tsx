"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { can as allowed, canVisit as visitable, type Action } from "./access";
import { useStore, useSync } from "./store";
import { today } from "./utils";
import type { UserAccount } from "@/types";

/**
 * Who is using the app.
 *
 * Every person signs in with their own email and password (lib/sync/cloud.ts).
 * Their name and role come from the FreshTrack user with the same email, so
 * the admin decides what each login may do on the Users screen.
 *
 * In the on-device demo copy (no database) a person just taps their name.
 */
const KEY = "freshtrack.session";

interface SessionValue {
  user: UserAccount | null;
  /** False until the saved sign-in has been read on this device. */
  ready: boolean;
  /** Demo copy only: choose who is using the device. */
  pick: (userId: string) => void;
  signOut: () => void;
  can: (action: Action) => boolean;
  canVisit: (pathname: string) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { users, setActor, saveUser } = useStore();
  const sync = useSync();
  const cloud = sync.mode === "cloud";
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [read, setRead] = useState(false);

  useEffect(() => {
    try {
      setPickedId(window.localStorage.getItem(KEY));
    } catch {
      /* storage blocked: choose every visit */
    }
    setRead(true);
  }, []);

  const email = sync.account?.email.trim().toLowerCase() ?? "";
  // A user switched off by the admin is signed out on their next screen.
  const user = cloud
    ? users.find((u) => u.isActive && email !== "" && u.email.trim().toLowerCase() === email) ?? null
    : users.find((u) => u.id === pickedId && u.isActive) ?? null;

  useEffect(() => {
    setActor(user?.id ?? null);
  }, [user, setActor]);

  // "Last active" on the Users screen, once a day.
  const stamped = useRef("");
  useEffect(() => {
    if (!user || user.lastActive === today() || stamped.current === `${user.id}:${today()}`) return;
    stamped.current = `${user.id}:${today()}`;
    saveUser({ ...user, lastActive: today() });
  }, [user, saveUser]);

  const remember = (id: string | null) => {
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* not remembered, still works for this visit */
    }
  };

  const pick = useCallback((id: string) => {
    setPickedId(id);
    remember(id);
  }, []);

  const { signOut: cloudSignOut } = sync;
  const signOut = useCallback(() => {
    setPickedId(null);
    remember(null);
    if (cloud) void cloudSignOut();
  }, [cloud, cloudSignOut]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      ready: read && sync.checked,
      pick,
      signOut,
      can: (action) => allowed(user?.role, action),
      canVisit: (pathname) => visitable(user?.role, pathname),
    }),
    [user, read, sync.checked, pick, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
