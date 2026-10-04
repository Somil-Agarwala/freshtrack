"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { can as allowed, canVisit as visitable, type Action } from "./access";
import { useStore } from "./store";
import { today } from "./utils";
import type { UserAccount } from "@/types";

/**
 * Who is using the app on this device. The choice is remembered, so a
 * godown phone stays signed in as Nikhil until someone taps "switch user".
 *
 * The PIN is checked in the browser. That tells the app who is working
 * and keeps casual mistakes out of admin screens, but anyone with the
 * code could get past it; real protection comes with Supabase auth.
 */
const KEY = "freshtrack.session";

interface SessionValue {
  user: UserAccount | null;
  /** False until the saved session has been read on this device. */
  ready: boolean;
  signIn: (userId: string, pin: string) => boolean;
  signOut: () => void;
  can: (action: Action) => boolean;
  canVisit: (pathname: string) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { users, setActor, saveUser } = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setUserId(window.localStorage.getItem(KEY));
    } catch {
      /* storage blocked: sign in every visit */
    }
    setReady(true);
  }, []);

  // A user switched off by the admin is signed out on their next screen.
  const user = users.find((u) => u.id === userId && u.isActive) ?? null;

  useEffect(() => {
    setActor(user?.id ?? null);
  }, [user, setActor]);

  const remember = (id: string | null) => {
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* not remembered, still works for this visit */
    }
  };

  const signIn = useCallback(
    (id: string, pin: string) => {
      const match = users.find((u) => u.id === id && u.isActive && u.pin === pin);
      if (!match) return false;
      setUserId(match.id);
      remember(match.id);
      if (match.lastActive !== today()) saveUser({ ...match, lastActive: today() });
      return true;
    },
    [users, saveUser]
  );

  const signOut = useCallback(() => {
    setUserId(null);
    remember(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      ready,
      signIn,
      signOut,
      can: (action) => allowed(user?.role, action),
      canVisit: (pathname) => visitable(user?.role, pathname),
    }),
    [user, ready, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
