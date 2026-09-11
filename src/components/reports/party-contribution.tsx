"use client";

import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatCurrency, formatNumber } from "@/lib/utils";

/** Which party's returns make up the claim value, by counted MRP value. */
export function PartyContribution() {
  const { collections, countLines } = useStore();

  const rows = distributors
    .map((d) => {
      const ids = new Set(collections.filter((c) => c.distributorId === d.id).map((c) => c.id));
      const lines = countLines.filter((l) => ids.has(l.collectionId));
      return {
        name: d.name,
        pieces: lines.reduce((sum, l) => sum + l.quantity, 0),
        value: lines.reduce((sum, l) => sum + l.quantity * l.mrp, 0),
      };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-dim">Nothing counted yet.</p>;
  }

  const max = Math.max(...rows.map((r) => r.value));

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink">{row.name}</span>
            <span className="shrink-0 text-ink-dim">
              {formatNumber(row.pieces)} pcs · {formatCurrency(row.value)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
