"use client";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const option = (value: "hi" | "en", label: string) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      className={cn(
        "h-9 min-w-11 rounded-full px-3 text-[15px]",
        lang === value ? "bg-ink font-bold text-night" : "bg-transparent font-semibold text-ink-dim"
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Language" className={cn("flex rounded-full bg-elevated p-1", className)}>
      {option("hi", "हिं")}
      {option("en", "EN")}
    </div>
  );
}
