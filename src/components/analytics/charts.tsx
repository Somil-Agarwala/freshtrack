"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_PROPS, GRID, SERIES, TOOLTIP, compactInr, rampStep } from "@/lib/viz";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Empty } from "./primitives";

/** Single-measure vertical bars. One hue; sequential shading optional. */
export function MagnitudeBars({
  data,
  xKey,
  valueKey,
  money = false,
  sequential = false,
  height = 240,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  valueKey: string;
  money?: boolean;
  sequential?: boolean;
  height?: number;
}) {
  if (data.length === 0) return <Empty message="Nothing to show yet." />;
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  const fmt = (v: number) => (money ? formatCurrency(v) : formatNumber(v));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => (money ? compactInr(v) : formatNumber(v))} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => fmt(v)} cursor={{ fill: "#171D26" }} />
          {/* 4px rounded data-end, anchored to the baseline. */}
          <Bar dataKey={valueKey} radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((d, i) => (
              <Cell key={i} fill={sequential ? rampStep(Number(d[valueKey]), max) : SERIES[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Two measures of the SAME unit (rupees vs rupees), so one shared axis is
 * correct -- never a second y-scale. Legend is always present for 2 series.
 */
export function PairedBars({
  data,
  xKey,
  aKey,
  bKey,
  aLabel,
  bLabel,
  height = 260,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  aKey: string;
  bKey: string;
  aLabel: string;
  bLabel: string;
  height?: number;
}) {
  if (data.length === 0) return <Empty message="Nothing to show yet." />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={compactInr} />
          <Tooltip {...TOOLTIP} formatter={(v: number) => formatCurrency(v)} cursor={{ fill: "#171D26" }} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#96A1B2", paddingTop: 8 }} iconType="circle" iconSize={8} />
          <Bar dataKey={aKey} name={aLabel} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey={bKey} name={bLabel} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Change over time. 2px lines, >=8px markers, crosshair tooltip. */
export function TrendLines({
  data,
  lines,
  money = false,
  height = 260,
}: {
  data: Record<string, string | number>[];
  lines: { key: string; label: string }[];
  money?: boolean;
  height?: number;
}) {
  if (data.length === 0) return <Empty message="Nothing to show yet." />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="month" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => (money ? compactInr(v) : formatNumber(v))} />
          <Tooltip
            {...TOOLTIP}
            formatter={(v: number) => (money ? formatCurrency(v) : formatNumber(v))}
            cursor={{ stroke: "#333D4B", strokeWidth: 1 }}
          />
          {lines.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 12, color: "#96A1B2", paddingTop: 8 }} iconType="circle" iconSize={8} />
          )}
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 0, fill: SERIES[i % SERIES.length] }}
              activeDot={{ r: 5, stroke: "#10141B", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Small multiples: one mini panel per entity, single hue, shared scale.
 * Used instead of a 5+ hue palette, which cannot stay colourblind-safe.
 */
export function SmallMultiples({
  panels,
  money = false,
}: {
  panels: { label: string; data: Record<string, string | number>[]; xKey: string; valueKey: string }[];
  money?: boolean;
}) {
  if (panels.length === 0) return <Empty message="Nothing to show yet." />;
  const globalMax = Math.max(
    ...panels.flatMap((p) => p.data.map((d) => Number(d[p.valueKey]))),
    1
  );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {panels.map((p) => (
        <div key={p.label} className="rounded-lg border border-line bg-elevated p-3">
          <p className="mb-2 truncate text-xs font-medium text-ink">{p.label}</p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={p.data} margin={{ top: 2, right: 2, left: -28, bottom: -8 }}>
                <XAxis dataKey={p.xKey} {...AXIS_PROPS} fontSize={10} />
                {/* Shared domain so panels are visually comparable. */}
                <YAxis {...AXIS_PROPS} fontSize={10} domain={[0, globalMax]} tickFormatter={() => ""} />
                <Tooltip {...TOOLTIP} formatter={(v: number) => (money ? formatCurrency(v) : formatNumber(v))} cursor={{ fill: "#202732" }} />
                <Bar dataKey={p.valueKey} fill={SERIES[0]} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
