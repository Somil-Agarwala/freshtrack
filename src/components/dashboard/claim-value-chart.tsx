"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export function ClaimValueChart() {
  const { sortedBags } = useStore();

  const byMrp = new Map<number, number>();
  sortedBags.forEach((bag) => {
    byMrp.set(bag.mrp, (byMrp.get(bag.mrp) ?? 0) + bag.pieceCount * bag.mrp);
  });

  const data = Array.from(byMrp.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([mrp, value]) => ({ tier: `MRP ${mrp}`, value }));

  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-dim">No bags packed yet.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(31 38 49)" vertical={false} />
          <XAxis dataKey="tier" stroke="rgb(105 117 135)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="rgb(105 117 135)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ background: "rgb(23 29 38)", border: "1px solid rgb(51 61 75)", borderRadius: 8, color: "rgb(233 238 245)" }}
            cursor={{ fill: "rgb(23 29 38)" }}
          />
          <Bar dataKey="value" fill="rgb(45 212 191)" radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
