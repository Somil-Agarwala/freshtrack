"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { siteConfig } from "@/config/site";

/**
 * Preferences kept on this device until accounts are wired up: for now
 * just the name used in greetings.
 */
const KEY = "freshtrack.userName";

const SettingsContext = createContext<{ userName: string; setUserName: (name: string) => void } | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [userName, setName] = useState(siteConfig.userName);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved) setName(saved);
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);

  const setUserName = useCallback((name: string) => {
    const next = name.trim() || siteConfig.userName;
    setName(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* not remembered, still works for this visit */
    }
  }, []);

  return <SettingsContext.Provider value={{ userName, setUserName }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
