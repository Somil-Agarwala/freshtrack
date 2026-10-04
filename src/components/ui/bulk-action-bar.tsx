import type { ReactNode } from "react";

// Fixed to the bottom so it sits in the thumb zone on a phone: directly
// above the bottom navigation there, and offset past the sidebar (pinned
// or not) on desktop so it never hides under it.
export function BulkActionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Selected items"
      className="fixed inset-x-0 bottom-[var(--nav-h)] z-30 border-t border-line-strong bg-elevated px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          <button onClick={onClear} className="-my-2 py-2 text-sm font-medium text-ink-faint hover:text-ink">
            Clear
          </button>
          <span className="text-sm font-medium text-ink">{count} selected</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
