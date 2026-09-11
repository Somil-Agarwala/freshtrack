"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { REASON_LABELS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import type { ReasonCategory } from "@/types";

export function ReasonBreakdownChart() {
  const { records } = useStore();

  const data = (Object.keys(REASON_LABELS) as ReasonCategory[])
    .map((reason) => ({
      reason: REASON_LABELS[reason],
      value: records.filter((r) => r.reason === reason).reduce((sum, r) => sum + r.costValue, 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-dim">No records logged yet.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(31 38 49)" horizontal={false} />
          <XAxis type="number" stroke="rgb(105 117 135)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <YAxis type="category" dataKey="reason" stroke="rgb(105 117 135)" fontSize={11} tickLine={false} axisLine={false} width={112} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ background: "rgb(23 29 38)", border: "1px solid rgb(51 61 75)", borderRadius: 8, color: "rgb(233 238 245)" }}
            cursor={{ fill: "rgb(23 29 38)" }}
          />
          <Bar dataKey="value" fill="rgb(251 191 36)" radius={[0, 6, 6, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
