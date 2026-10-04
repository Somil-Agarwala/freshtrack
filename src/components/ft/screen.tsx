"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Company } from "@/types";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "./brand";
import { BackIcon, ClockIcon } from "./icons";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const WIDTHS = {
  narrow: "max-w-[600px]",
  wide: "max-w-[960px]",
  full: "max-w-[1360px]",
};

/**
 * One full screen. On a phone it fills the viewport above the bottom menu;
 * on a desktop it is a centred column under the top header, so the same
 * big-button flow works with a mouse without stretching across 1440px.
 */
export function Screen({ children, width = "narrow", className }: { children: ReactNode; width?: keyof typeof WIDTHS; className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full flex-col", "min-h-[calc(100dvh-var(--nav-h))] lg:min-h-[calc(100dvh-69px)]", WIDTHS[width], className)}>
      {children}
    </div>
  );
}

export function ScreenBody({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("flex flex-1 flex-col gap-3.5 px-4 pb-4 pt-2 lg:pt-4", className)}>{children}</main>;
}

/** Bar pinned to the bottom of the screen holding the main button. */
export function ScreenFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer
      className={cn(
        "sticky bottom-[var(--nav-h)] z-20 flex flex-col gap-2 border-t border-line bg-bar px-4 pt-3",
        "pb-[calc(14px+var(--safe-b))] lg:mb-4 lg:rounded-[20px] lg:border lg:pb-3.5",
        className
      )}
    >
      {children}
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Headers                                                             */
/* ------------------------------------------------------------------ */

export function BackButton({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-elevated transition-colors hover:bg-raised"
    >
      <BackIcon />
    </Link>
  );
}

const STEP_TEXT: Record<Tone, string> = {
  pickup: "text-pickup",
  count: "text-count",
  pile: "text-pile",
  factory: "text-factory",
  money: "text-money",
  godown: "text-godown",
  neutral: "text-ink",
};
const STEP_FILL: Record<Tone, string> = {
  pickup: "bg-pickup",
  count: "bg-count",
  pile: "bg-pile",
  factory: "bg-factory",
  money: "bg-money",
  godown: "bg-godown",
  neutral: "bg-ink",
};

/** Back button, "नया माल · चरण 1 / 3" and the three-part progress bar. */
export function StepHeader({ back, step, total, tone, hi, en }: { back: string; step: number; total: number; tone: Tone; hi: string; en: string }) {
  const { t, sub, lang } = useLang();
  return (
    <header className="flex items-center gap-3 px-4 pb-1.5 pt-4">
      <BackButton href={back} />
      <div className="flex-1">
        <p className={cn("mb-1.5 text-sm font-bold", STEP_TEXT[tone])}>
          {t(hi, en)} · {lang === "hi" ? `चरण ${step} / ${total}` : `Step ${step} of ${total}`}{" "}
          <span className="font-medium text-ink-faint">· {lang === "hi" ? `Step ${step} of ${total}` : sub(hi, en)}</span>
        </p>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full", i < step ? STEP_FILL[tone] : "bg-raised")} />
          ))}
        </div>
      </div>
    </header>
  );
}

/** Back button + small coloured kicker + one line of detail. */
export function TaskHeader({ back, kicker, tone, children, aside }: { back: string; kicker: ReactNode; tone: Tone; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-4">
      <BackButton href={back} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-bold", STEP_TEXT[tone])}>{kicker}</p>
        {children}
      </div>
      {aside}
    </header>
  );
}

const TILE: Record<Tone, string> = {
  pickup: "bg-pickup-tint text-pickup",
  count: "bg-count-tint text-count",
  pile: "bg-pile-tint text-pile",
  factory: "bg-factory-tint text-factory",
  money: "bg-money-tint text-money",
  godown: "bg-godown-tint text-godown",
  neutral: "bg-elevated text-ink",
};

/** Header of the list screens (count, piles, send): icon tile + big title. */
export function ListHeader({
  icon,
  tone,
  title,
  subtitle,
  back,
  children,
}: {
  icon: ReactNode;
  tone: Tone;
  title: ReactNode;
  subtitle: ReactNode;
  back?: string;
  children?: ReactNode;
}) {
  return (
    <header className="px-4 pb-2 pt-[18px]">
      <div className="flex items-center gap-3">
        {back ? <BackButton href={back} /> : <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]", TILE[tone])}>{icon}</span>}
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-extrabold leading-[1.1]">{title}</h1>
          <p className="text-[15px] text-ink-dim">{subtitle}</p>
        </div>
      </div>
      {children}
    </header>
  );
}

/** Big heading + English/Hindi line under it, as on every step screen. */
export function Question({ hi, en, className }: { hi: string; en: string; className?: string }) {
  const { t, sub } = useLang();
  return (
    <div className={className}>
      <h1 className="font-display text-[30px] font-extrabold leading-[1.1]">{t(hi, en)}</h1>
      <p className="mt-1 text-base text-ink-dim">{sub(hi, en)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export type Tone = "pickup" | "count" | "pile" | "factory" | "money" | "godown" | "neutral";

const BIG: Record<Tone, string> = {
  pickup: "bg-pickup text-pickup-ink hover:brightness-110",
  count: "bg-count text-count-ink hover:brightness-110",
  pile: "bg-pile text-pile-ink hover:brightness-110",
  factory: "bg-factory text-factory-ink hover:brightness-110",
  money: "bg-money text-money-ink hover:brightness-110",
  godown: "bg-godown text-godown-ink hover:brightness-110",
  neutral: "bg-elevated text-ink hover:bg-raised",
};

const bigClass = (tone: Tone, className?: string) =>
  cn(
    "flex h-16 w-full items-center justify-center gap-2.5 rounded-[18px] px-4 text-center font-display text-xl font-extrabold leading-[1.1] transition",
    "disabled:pointer-events-none disabled:opacity-40",
    BIG[tone],
    className
  );

export function BigLink({ tone, className, ...props }: ComponentProps<typeof Link> & { tone: Tone }) {
  return <Link className={bigClass(tone, className)} {...props} />;
}

export function BigButton({ tone, className, ...props }: ComponentProps<"button"> & { tone: Tone }) {
  return <button type="button" className={bigClass(tone, className)} {...props} />;
}

/** Secondary 52-60px grey button. */
export const softButton =
  "flex h-[60px] items-center justify-center gap-2 rounded-2xl border border-line bg-elevated px-3 text-base font-bold transition-colors hover:bg-raised disabled:opacity-40";

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

/** Company filter chips. `tone` colours the selected chip by step. */
export function CompanyTabs({
  companies,
  value,
  onChange,
  tone,
  counts,
  all,
}: {
  companies: Company[];
  value: string;
  onChange: (id: string) => void;
  tone: Tone;
  counts?: Record<string, ReactNode>;
  /** Label of an "all companies" chip, if the screen has one. */
  all?: ReactNode;
}) {
  const active = BIG[tone].split(" ").slice(0, 2).join(" ");
  return (
    <div role="tablist" aria-label="Company" className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4">
      {all !== undefined && (
        <button
          role="tab"
          aria-selected={value === "all"}
          onClick={() => onChange("all")}
          className={cn(
            "h-11 shrink-0 rounded-full px-4 text-base",
            value === "all" ? cn(active, "font-bold") : "border border-line bg-surface font-semibold"
          )}
        >
          {all}
        </button>
      )}
      {companies.map((company) => {
        const selected = value === company.id;
        return (
          <button
            key={company.id}
            role="tab"
            aria-selected={selected}
            aria-label={company.name}
            onClick={() => onChange(company.id)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-base",
              selected ? cn(active, "font-bold") : "border border-line bg-surface font-semibold"
            )}
          >
            <CompanyAvatar company={company} size={32} />
            {counts?.[company.id] ?? company.name}
          </button>
        );
      })}
    </div>
  );
}

/** How long something has been waiting: grey, then yellow, then red. */
export function AgePill({ days, warnAt = 5, alarmAt = 7, todayLabel, clock }: { days: number; warnAt?: number; alarmAt?: number; todayLabel?: string; clock?: boolean }) {
  const { lang } = useLang();
  const tone = days >= alarmAt ? "bg-danger-tint text-danger-soft" : days >= warnAt ? "bg-count-tint text-count-soft" : "bg-elevated text-ink-dim";
  const text = days === 0 ? todayLabel ?? (lang === "hi" ? "आज" : "Today") : lang === "hi" ? `${days} दिन` : `${days} days`;
  return (
    <span className={cn("flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold", tone)}>
      {clock && days >= alarmAt && <ClockIcon size={14} />}
      {text}
    </span>
  );
}

const NOTE: Record<string, string> = {
  godown: "bg-godown-tint text-godown-soft",
  pickup: "bg-pickup-tint text-pickup-note",
  count: "bg-count-tint text-count-note",
  money: "bg-money-tint text-money-note",
  danger: "bg-danger-tint text-danger-note border border-danger-line",
  neutral: "bg-surface text-ink-dim",
};
const NOTE_SUB: Record<string, string> = {
  godown: "text-godown-mute",
  pickup: "text-pickup-mute",
  count: "text-count-mute",
  money: "text-money-mute",
  danger: "text-danger-mute",
  neutral: "text-ink-faint",
};

/** Coloured hint box: bold line plus a smaller line in the other language. */
export function Note({ tone, icon, hi, en, bold, className }: { tone: keyof typeof NOTE; icon?: ReactNode; hi: ReactNode; en: ReactNode; bold?: boolean; className?: string }) {
  const { lang } = useLang();
  const [main, other] = lang === "hi" ? [hi, en] : [en, hi];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl p-3.5 text-[15px] leading-[1.35]", NOTE[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span>
        {bold ? <b className="font-bold">{main}</b> : main}
        <br />
        <span className={cn("text-sm", NOTE_SUB[tone])}>{other}</span>
      </span>
    </div>
  );
}

/** Pile fill bar: what is already in the pile, then what this bag adds. */
export function PileBar({ existing, adding = 0, capacity, height = 18, label }: { existing: number; adding?: number; capacity: number; height?: number; label: string }) {
  const a = Math.min(100, (existing / capacity) * 100);
  const b = Math.min(100 - a, (adding / capacity) * 100);
  return (
    <div role="img" aria-label={label} className="flex overflow-hidden rounded-full bg-raised" style={{ height }}>
      <span className="bg-pile-fill" style={{ width: `${a}%` }} />
      {b > 0 && <span className="bg-pile" style={{ width: `${b}%` }} />}
    </div>
  );
}

export function SectionTitle({ hi, en, count }: { hi: string; en: string; count?: ReactNode }) {
  const { t, sub } = useLang();
  return (
    <h2 className="mx-0.5 mt-1 font-display text-[21px] font-extrabold">
      {t(hi, en)}{" "}
      <span className="font-sans text-sm font-medium text-ink-faint">
        · {count ?? sub(hi, en)}
      </span>
    </h2>
  );
}
