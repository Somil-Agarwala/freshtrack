"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { rampStep } from "@/lib/viz";

export function Panel({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface p-5", className)}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-ink-dim">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-ink-dim">{message}</p>;
}

/**
 * Horizontal ranked bars. Used instead of a pie for share-of-total, and
 * instead of a multi-hue chart for any single-measure ranking: one hue,
 * magnitude carried by length, with the value labelled directly so identity
 * never depends on colour.
 */
export function RankedBars({
  rows,
  format,
  sequential = false,
}: {
  rows: { label: string; value: number; sub?: string }[];
  format: (v: number) => string;
  sequential?: boolean;
}) {
  if (rows.length === 0) return <Empty message="Nothing to show yet." />;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink-dim">
              {format(r.value)}
              {r.sub && <span className="ml-2 text-xs text-ink-faint">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((r.value / max) * 100, 1.5)}%`,
                background: sequential ? rampStep(r.value, max) : "#0D9488",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Compact metric, for rows of 3-4. */
export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warning" | "critical";
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-emerald-300",
    warning: "text-amber-300",
    critical: "text-rose-300",
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-dim">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums tracking-tight", toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Plain table view, so every chart has a readable non-visual equivalent. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <Empty message="Nothing to show yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-ink-faint">
            {head.map((h, i) => (
              <th key={h} className={cn("py-2 pr-4 font-medium", i > 0 && "text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} className={cn("py-2 pr-4", ci === 0 ? "text-ink" : "text-right tabular-nums text-ink-dim")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
