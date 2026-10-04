"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./i18n";

/* Phone features the screens use: speaking a search, reading instructions
   aloud, sharing to WhatsApp and printing labels. Each degrades quietly
   on a browser that lacks it. */

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Tap the mic, say a name, and `onText` receives what was heard. */
export function useVoiceInput(onText: (text: string) => void, lang: Lang) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const active = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  useEffect(() => {
    setSupported(!!recognitionCtor());
    return () => active.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    active.current?.abort();
    const rec = new Ctor();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript;
      if (text) callback.current(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    active.current = rec;
    setListening(true);
    rec.start();
    return true;
  }, [lang]);

  return { supported, listening, start };
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Reads `text` aloud, in Hindi when the screen is in Hindi. */
export function speak(text: string, lang: Lang) {
  if (!canSpeak()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function shareOnWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

/** A short message that disappears by itself. */
export function useFlash(ms = 3500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number>();
  const flash = useCallback(
    (text: string) => {
      setMessage(text);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(null), ms);
    },
    [ms]
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [message, flash] as const;
}

/** Whether this browser can read text aloud (known only after mounting). */
export function useCanSpeak() {
  const [can, setCan] = useState(false);
  useEffect(() => setCan(canSpeak()), []);
  return can;
}
