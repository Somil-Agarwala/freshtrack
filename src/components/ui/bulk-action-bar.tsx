import type { ReactNode } from "react";

// Fixed to the bottom edge so it sits in the thumb zone on a phone, and
// offset past the desktop rail so it never hides under the sidebar.
export function BulkActionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-elevated px-4 py-3 lg:left-[72px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onClear} className="text-sm font-medium text-ink-faint hover:text-ink">
            Clear
          </button>
          <span className="text-sm font-medium text-ink">{count} selected</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
