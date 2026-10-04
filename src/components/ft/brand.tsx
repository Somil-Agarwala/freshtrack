import type { Company, Product } from "@/types";
import { cn } from "@/lib/utils";
import {
  ProductBarIcon,
  ProductBiscuitIcon,
  ProductBlockIcon,
  ProductDotsIcon,
  ProductGridIcon,
  ProductWaferIcon,
} from "./icons";

/* Each company keeps one colour everywhere, so a CAD bag is purple on the
   pickup tile, the count list, the label and the dispatch slip alike. */
const COMPANY_COLORS: Record<string, string> = {
  CAD: "#6B3FD1",
  HLD: "#C2410C",
  UNI: "#0B7A6B",
  RBL: "#2A4FA8",
  LOT: "#B0204F",
  LNK: "#3A4150",
};
const FALLBACK = ["#7C4A1E", "#1F6F8B", "#6D3A8C", "#3F6B21", "#8B2F4F", "#2F4A8B"];

function hash(text: string): number {
  return Array.from(text).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

export function companyColor(code: string): string {
  return COMPANY_COLORS[code] ?? FALLBACK[hash(code) % FALLBACK.length];
}

export function CompanyAvatar({ company, size = 44, className }: { company?: Company; size?: number; className?: string }) {
  const code = company?.code ?? "—";
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full font-extrabold tracking-[0.5px] text-white", className)}
      style={{ width: size, height: size, background: companyColor(code), fontSize: Math.max(10, Math.round(size * 0.29)) }}
    >
      {code}
    </span>
  );
}

/* MRP tiers read by colour first: ₹5 silver, ₹10 brown, ₹20 lime, ₹30 brick. */
const MRP_COLORS: Record<number, { bg: string; fg: string }> = {
  5: { bg: "#C9CED6", fg: "#1A1D22" },
  10: { bg: "#8A5530", fg: "#FFFFFF" },
  20: { bg: "#C5CC4A", fg: "#1E2108" },
  30: { bg: "#B5503A", fg: "#FFFFFF" },
};
const MRP_FALLBACK = [
  { bg: "#4F7CAC", fg: "#FFFFFF" },
  { bg: "#7A5BA6", fg: "#FFFFFF" },
  { bg: "#2F8F83", fg: "#FFFFFF" },
];

export function mrpColor(mrp: number) {
  return MRP_COLORS[mrp] ?? MRP_FALLBACK[mrp % MRP_FALLBACK.length];
}

/** Round MRP badge, e.g. the ₹10 circle at the start of a pile row. */
export function MrpCircle({ mrp, size = 44, className }: { mrp: number; size?: number; className?: string }) {
  const c = mrpColor(mrp);
  const label = `₹${mrp}`;
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full font-display font-extrabold leading-none", className)}
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        fontSize: Math.round(size * (label.length > 4 ? 0.26 : 0.36)),
      }}
    >
      {label}
    </span>
  );
}

/** Pill MRP badge used inside product tiles and labels. */
export function MrpChip({ mrp, prefix, className }: { mrp: number; prefix?: string; className?: string }) {
  const c = mrpColor(mrp);
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[15px] font-extrabold", className)} style={{ background: c.bg, color: c.fg }}>
      {prefix}₹{mrp}
    </span>
  );
}

/* Party tiles get a soft colour from their name so the list scans quickly. */
const PARTY_TONES = [
  { bg: "#24364D", fg: "#9CCBFF" },
  { bg: "#3A2A47", fg: "#D8B9FF" },
  { bg: "#44331C", fg: "#FFD38A" },
  { bg: "#1E3B33", fg: "#8FE6C4" },
  { bg: "#46222B", fg: "#FFB3C1" },
];

export function partyTone(name: string) {
  return PARTY_TONES[hash(name) % PARTY_TONES.length];
}

const PRODUCT_TONES = [
  { bg: "#2A2016", fg: "#D9A066" },
  { bg: "#2B1B14", fg: "#C58A6A" },
  { bg: "#2A2416", fg: "#D7C27A" },
  { bg: "#222A16", fg: "#B8C85A" },
  { bg: "#1E2030", fg: "#9AA6E6" },
  { bg: "#2B1A17", fg: "#E08A73" },
];
const PRODUCT_ICONS = [ProductBiscuitIcon, ProductBarIcon, ProductWaferIcon, ProductGridIcon, ProductDotsIcon, ProductBlockIcon];

/** Picture tile for a product, so helpers can find it without reading. */
export function ProductPicture({ product, className, size = 28 }: { product: Product; className?: string; size?: number }) {
  const key = hash(product.category + product.name);
  const tone = PRODUCT_TONES[key % PRODUCT_TONES.length];
  const Icon = PRODUCT_ICONS[hash(product.name) % PRODUCT_ICONS.length];
  return (
    <span className={cn("flex items-center justify-center rounded-xl", className)} style={{ background: tone.bg, color: tone.fg }}>
      <Icon size={size} />
    </span>
  );
}
