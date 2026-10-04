/**
 * Chart parameters for the whole app, in one place.
 *
 * The categorical palette is capped at THREE slots on purpose: validated
 * all-pairs on this app's dark surface (#10141B), teal/amber/violet are the
 * largest set where every pair stays distinguishable under deuteranopia,
 * protanopia and tritanopia. A fourth hue drops the amber-rose pair to a
 * ΔE around 6, which is only legal with extra encoding, so anything needing
 * more than three series uses small multiples (one panel per entity, single
 * hue) rather than a cycled palette.
 */
export const SERIES = ["#0D9488", "#D97706", "#8B5CF6"] as const;

/** Single hue for magnitude. Monotone lightness, light end still legible. */
export const SEQUENTIAL = ["#134E4A", "#115E59", "#0F766E", "#0D9488", "#14B8A6", "#2DD4BF"] as const;

/** Reserved for state. Always shipped with a label, never colour alone. */
export const STATUS = {
  good: "#10B981",
  warning: "#D97706",
  critical: "#E11D48",
  neutral: "#475569",
} as const;

export const AXIS = "#8B94A3";
export const GRID = "#2B313C";
export const INK = "#F2F4F7";

/** Shared recharts tooltip styling so every chart reads as one system. */
export const TOOLTIP = {
  contentStyle: {
    background: "#1F242D",
    border: "1px solid #3A4150",
    borderRadius: 12,
    color: INK,
    fontSize: 12,
  },
  labelStyle: { color: "#B4BCC8" },
} as const;

export const AXIS_PROPS = {
  stroke: AXIS,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

/** Compact INR for axis ticks: 1.2L, 45k. Full value goes in the tooltip. */
export function compactInr(value: number): string {
  const n = Math.abs(value);
  if (n >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${(value / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(Math.round(value));
}

/** Sequential step for a value's position in a range. */
export function rampStep(value: number, max: number): string {
  if (max <= 0) return SEQUENTIAL[0];
  const i = Math.min(SEQUENTIAL.length - 1, Math.floor((value / max) * SEQUENTIAL.length));
  return SEQUENTIAL[i];
}
