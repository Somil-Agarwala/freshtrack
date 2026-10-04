"use client";

import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CheckIcon, FileIcon, SearchIcon } from "./icons";

/* Building blocks shared by the list and form screens. */

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn("flex h-[54px] min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-line-strong", className)}>
      <SearchIcon size={22} className="shrink-0 text-ink-faint" />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-faint"
      />
    </label>
  );
}

const CHIP_ON: Record<string, string> = {
  pickup: "bg-pickup text-pickup-ink",
  count: "bg-count text-count-ink",
  pile: "bg-pile text-pile-ink",
  factory: "bg-factory text-factory-ink",
  money: "bg-money text-money-ink",
  godown: "bg-godown text-godown-ink",
  neutral: "bg-ink text-night",
};

/** A row of filter chips; one is selected. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  tone = "neutral",
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  tone?: keyof typeof CHIP_ON;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-base", value === o.value ? cn(CHIP_ON[tone], "font-bold") : "border border-line bg-surface font-semibold")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pick-one buttons inside a form, bigger than chips. */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  tone = "neutral",
  columns = 2,
}: {
  options: { value: T; label: ReactNode; detail?: ReactNode }[];
  value: T | "";
  onChange: (v: T) => void;
  tone?: keyof typeof CHIP_ON;
  columns?: 2 | 3;
}) {
  return (
    <div className={cn("grid gap-2", columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn("relative flex min-h-[56px] flex-col justify-center rounded-2xl border-2 px-3 py-2 text-left", on ? "border-current bg-surface" : "border-line bg-surface", on && TONE_TEXT[tone])}
          >
            <span className={cn("text-base font-bold leading-tight", on ? "" : "text-ink")}>{o.label}</span>
            {o.detail && <span className="text-[13px] font-medium text-ink-dim">{o.detail}</span>}
            {on && <CheckIcon size={16} className="absolute right-2.5 top-2.5" />}
          </button>
        );
      })}
    </div>
  );
}

const TONE_TEXT: Record<string, string> = {
  pickup: "text-pickup",
  count: "text-count",
  pile: "text-pile",
  factory: "text-factory",
  money: "text-money",
  godown: "text-godown",
  neutral: "text-ink",
};

/** Labelled form field with the label in both languages. */
export function Field({ hi, en, optional, children, hint }: { hi: string; en: string; optional?: boolean; children: ReactNode; hint?: ReactNode }) {
  const { t, sub } = useLang();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-bold">
        {t(hi, en)}{" "}
        <span className="font-medium text-ink-faint">
          · {sub(hi, en)}
          {optional ? ` (${t("ज़रूरी नहीं", "optional")})` : ""}
        </span>
      </span>
      {children}
      {hint && <span className="text-sm text-ink-dim">{hint}</span>}
    </div>
  );
}

export const inputClass =
  "h-14 w-full min-w-0 rounded-2xl border border-line bg-surface px-4 text-[17px] text-ink outline-none placeholder:text-ink-faint focus:border-line-strong disabled:opacity-50";

/** On / off switch row. */
export function Toggle({ on, onChange, label, detail }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; detail?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-surface px-3.5 text-left">
      <span className="flex-1">
        <span className="block text-base font-bold">{label}</span>
        {detail && <span className="block text-sm text-ink-dim">{detail}</span>}
      </span>
      <span className={cn("flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors", on ? "bg-money" : "bg-raised")}>
        <span className={cn("h-6 w-6 rounded-full bg-white transition-transform", on && "translate-x-6")} />
      </span>
    </button>
  );
}

/** Small "Excel" button for list screens. */
export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-elevated px-3 text-[15px] font-bold text-ink-dim hover:bg-raised hover:text-ink disabled:opacity-40"
    >
      <FileIcon size={20} />
      {t("Excel", "Excel")}
    </button>
  );
}

export function EmptyCard({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface px-4 py-10 text-center">
      <p className="font-display text-2xl font-extrabold">{title}</p>
      {detail && <p className="mt-1 text-ink-dim">{detail}</p>}
    </div>
  );
}

const PILL: Record<string, string> = {
  pickup: "bg-pickup-tint text-pickup-soft",
  count: "bg-count-tint text-count-soft",
  pile: "bg-pile-tint text-pile-soft",
  factory: "bg-factory-tint text-factory-soft",
  money: "bg-money-tint text-money",
  godown: "bg-godown-tint text-godown-soft",
  danger: "bg-danger-tint text-danger-soft",
  neutral: "bg-elevated text-ink-dim",
};

export function Pill({ tone, children, className }: { tone: keyof typeof PILL; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold", PILL[tone], className)}>{children}</span>;
}

/** Two-line stat tile used at the top of list screens. */
export function StatTile({ label, value, foot, tone }: { label: string; value: string; foot?: string; tone?: "money" | "factory" | "godown" | "count" | "pile" | "pickup" }) {
  const box: Record<string, string> = {
    money: "border-money-line bg-money-tint",
    factory: "border-factory-line bg-factory-panel",
    godown: "border-godown-line bg-godown-panel",
    count: "border-count-tint bg-count-tint",
    pile: "border-pile-tint bg-pile-deep",
    pickup: "border-pickup-tint bg-pickup-tint",
  };
  const text: Record<string, string> = { money: "text-money", factory: "text-factory", godown: "text-godown", count: "text-count", pile: "text-pile", pickup: "text-pickup" };
  return (
    <div className={cn("min-w-0 rounded-2xl border p-3", tone ? box[tone] : "border-line bg-surface")}>
      <p className="truncate text-sm text-ink-dim">{label}</p>
      <p className={cn("truncate font-display font-extrabold leading-[1.1]", value.length > 7 ? "text-xl max-[380px]:text-lg" : "text-2xl max-[380px]:text-xl", tone && text[tone])}>{value}</p>
      {foot && <p className="truncate text-xs text-ink-faint">{foot}</p>}
    </div>
  );
}
