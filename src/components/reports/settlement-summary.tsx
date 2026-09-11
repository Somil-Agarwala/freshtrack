"use client";

import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

/** Claimed vs received across dispatches, so shortfalls stay visible. */
export function SettlementSummary() {
  const { dispatches } = useStore();

  if (dispatches.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-dim">No dispatches yet.</p>;
  }

  const claimed = dispatches.reduce((sum, d) => sum + d.claimedValue, 0);
  const received = dispatches.reduce((sum, d) => sum + (d.receivedValue ?? 0), 0);
  const recoveryRate = claimed > 0 ? Math.round((received / claimed) * 100) : 0;

  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className="flex items-center justify-center bg-accent text-xs font-medium text-accent-ink"
          style={{ width: `${Math.min(recoveryRate, 100)}%` }}
        >
          {recoveryRate > 12 && `${recoveryRate}%`}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-ink-faint">Claimed</p>
          <p className="mt-0.5 text-lg font-semibold text-ink">{formatCurrency(claimed)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Received</p>
          <p className="mt-0.5 text-lg font-semibold text-accent">{formatCurrency(received)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Shortfall</p>
          <p className="mt-0.5 text-lg font-semibold text-amber-300">{formatCurrency(claimed - received)}</p>
        </div>
      </div>
    </div>
  );
}
