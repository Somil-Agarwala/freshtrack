"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import { NewCollectionDialog } from "./new-collection-dialog";

/**
 * Logging a pickup is the most frequent action in the app, so the dialog
 * lives at the root and can be opened from anywhere: the phone bottom
 * bar, the dashboard and the Collections page all call open(). Before,
 * the dashboard button only navigated to the list and you had to find
 * the button again.
 */
const LogCollectionContext = createContext<{ open: () => void }>({ open: () => {} });

export function LogCollectionProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number>();

  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  function handleCreated(message: string) {
    setNotice(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), 4500);
  }

  return (
    <LogCollectionContext.Provider value={value}>
      {children}
      <NewCollectionDialog open={isOpen} onClose={() => setIsOpen(false)} onCreated={handleCreated} />
      <Notice message={notice} />
    </LogCollectionContext.Provider>
  );
}

export function useLogCollection() {
  return useContext(LogCollectionContext);
}
