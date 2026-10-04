"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Pieces counted so far, per bag, before "Done counting" saves them.
 * Held above the pages so moving between the item tiles and the keypad
 * (separate addresses, so the phone's back button works) never loses a
 * half-finished count.
 */
type Draft = Record<string, number>;

interface DraftValue {
  get: (collectionId: string) => Draft | undefined;
  set: (collectionId: string, draft: Draft) => void;
  clear: (collectionId: string) => void;
}

const DraftContext = createContext<DraftValue | null>(null);

export function CountDraftProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, Draft>());
  const [, rerender] = useState(0);

  const get = useCallback((id: string) => drafts.current.get(id), []);
  const set = useCallback((id: string, draft: Draft) => {
    drafts.current.set(id, draft);
    rerender((n) => n + 1);
  }, []);
  const clear = useCallback((id: string) => {
    drafts.current.delete(id);
    rerender((n) => n + 1);
  }, []);

  return <DraftContext.Provider value={{ get, set, clear }}>{children}</DraftContext.Provider>;
}

export function useCountDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useCountDraft must be used inside CountDraftProvider");
  return value;
}
