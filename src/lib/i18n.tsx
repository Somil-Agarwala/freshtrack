"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Every screen is bilingual: one language leads in the big text, the other
 * sits underneath in small grey text, so a helper who reads only Hindi and
 * an owner who prefers English both read the same screen. The हिं / EN
 * switch decides which one leads; it never hides the other.
 */
export type Lang = "hi" | "en";

const KEY = "freshtrack.lang";

interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** The leading text: Hindi in हिं mode, English in EN mode. */
  t: (hi: string, en: string) => string;
  /** The supporting text: whichever language is not leading. */
  sub: (hi: string, en: string) => string;
}

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("hi");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "hi" || saved === "en") setLangState(saved);
    } catch {
      /* storage blocked: stay on Hindi */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* not remembered, still works for this visit */
    }
  }, []);

  const t = useCallback((hi: string, en: string) => (lang === "hi" ? hi : en), [lang]);
  const sub = useCallback((hi: string, en: string) => (lang === "hi" ? en : hi), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t, sub }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const value = useContext(LangContext);
  if (!value) throw new Error("useLang must be used inside LangProvider");
  return value;
}
