"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The search-and-filter strip above a list. On a phone, three or four
 * stacked dropdowns pushed the list itself a whole screen down, so there
 * the search stays visible and the dropdowns fold behind a "Filters"
 * button that shows how many are set. From sm up, everything sits in one
 * row as before.
 */
export function FilterPanel({
  search,
  filters,
  activeCount,
  onClearFilters,
  summary,
}: {
  search: ReactNode;
  filters: ReactNode;
  /** How many dropdowns are set to something other than "All". */
  activeCount: number;
  onClearFilters: () => void;
  /** Right-hand side: "Select all" and the result count. */
  summary: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1 sm:[&>*:first-child]:flex-none">
            {search}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium sm:hidden",
                open || activeCount > 0 ? "border-accent/50 bg-accent/10 text-accent" : "border-line-strong bg-elevated text-ink-dim"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
          {/* display:contents from sm up, so the dropdowns join the row. */}
          <div className={cn("grid-cols-2 gap-2 sm:contents", open ? "grid" : "hidden")}>
            {filters}
            {activeCount > 0 && (
              <button type="button" onClick={onClearFilters} className="col-span-2 h-10 text-sm font-medium text-ink-dim hover:text-ink sm:col-auto sm:h-auto">
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-start">{summary}</div>
      </div>
    </div>
  );
}
