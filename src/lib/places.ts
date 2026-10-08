import type { Company, PilePlace, Product } from "@/types";

/**
 * Where piles lie in the godown. A pile is one company's pieces of one MRP,
 * so its placard code is built from those two -- HLD-10 is Haldiram's ₹10
 * pile -- and stays the same however often the pile empties and refills.
 */

/** The code written on a pile's placard, e.g. HLD-10. */
export function pileCode(company: Pick<Company, "code"> | undefined, mrp: number): string {
  return `${company?.code ?? "—"}-${mrp}`;
}

export function findPlace(places: PilePlace[], companyId: string, mrp: number): PilePlace | undefined {
  return places.find((p) => p.companyId === companyId && p.mrp === mrp);
}

/**
 * Every MRP a company's goods come in: its active products plus any pile
 * already lying in the godown. One placard each makes a full set.
 */
export function companyMrps(products: Product[], companyId: string, extra: number[] = []): number[] {
  const mrps = products.filter((p) => p.companyId === companyId && p.isActive).map((p) => p.mrp);
  return Array.from(new Set([...mrps, ...extra])).sort((a, b) => a - b);
}

/**
 * Spots already written down, offered as one-tap choices so the same corner
 * is not typed five different ways. This company's spots come first.
 */
export function wherePresets(places: PilePlace[], companyId: string, limit = 6): string[] {
  const ordered = [...places.filter((p) => p.companyId === companyId), ...places.filter((p) => p.companyId !== companyId)];
  return Array.from(new Set(ordered.map((p) => p.where))).slice(0, limit);
}
