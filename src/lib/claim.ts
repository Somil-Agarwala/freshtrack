import type { CountLine, Product, SortedBag } from "@/types";

/**
 * What a company pays for one damaged piece. Some companies settle at the
 * printed MRP; others (Haldiram) at their own claim rate, e.g. ₹3.74 for a
 * ₹5 Namkeen. A product with no claim rate is claimed at MRP.
 */
export function claimRateOf(product: Pick<Product, "mrp" | "claimRate"> | undefined, mrp: number): number {
  return product?.claimRate ?? mrp;
}

/** Claim value of a counted line, at the rate fixed when it was counted. */
export function lineValue(line: Pick<CountLine, "quantity" | "mrp" | "rate">): number {
  return line.quantity * (line.rate ?? line.mrp);
}

/** Claim value of a tied bag: worked out from what went into it. */
export function bagValue(bag: Pick<SortedBag, "pieceCount" | "mrp" | "claimValue">): number {
  return bag.claimValue ?? bag.pieceCount * bag.mrp;
}
