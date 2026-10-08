import type { CollectionBag, Company, CountLine, DamageRecord, Dispatch, Distributor, Product, SortedBag, UserAccount } from "@/types";
import { HALDIRAM_DEALERS, HALDIRAM_PRODUCTS } from "./data/haldiram";
import { STOCK_PRODUCTS } from "./data/stock-products";

/**
 * What the app starts with: the companies, their products, the parties and
 * the sign-in accounts. No pickups, counts, bags, dispatches or godown
 * entries -- those are entered through the app.
 *
 * Until the database is connected, a reload returns to exactly this.
 */

export const companies: Company[] = [
  { id: "co1", name: "Cadbury", code: "CAD", isActive: true },
  { id: "co2", name: "Haldirams", code: "HLD", isActive: true },
  { id: "co3", name: "Unicharm", code: "UNI", isActive: true },
  { id: "co4", name: "Red Bull", code: "RBL", isActive: true },
  { id: "co5", name: "Lotte", code: "LOT", isActive: true },
  { id: "co6", name: "Link", code: "LNK", isActive: true },
];

export const products: Product[] = [
  // Haldiram: the sheet's RATE is what Haldiram pays per damaged piece.
  ...HALDIRAM_PRODUCTS.map(([id, name, category, mrp, rate]) => ({
    id,
    companyId: "co2",
    sku: `HLD-${id.slice(3).toUpperCase()}`,
    name,
    category,
    unit: "pack",
    mrp,
    costPrice: rate,
    claimRate: rate,
    isActive: true,
  })),
  // Unicharm, Lotte and Red Bull, from the stock report. Claimed at MRP
  // until a claim rate is set on the Products page.
  ...STOCK_PRODUCTS.map(([id, companyId, name, category, mrp]) => ({
    id,
    companyId,
    sku: id.slice(3, 23).toUpperCase(),
    name,
    category,
    unit: "piece",
    mrp,
    costPrice: 0,
    isActive: true,
  })),
];

export const distributors: Distributor[] = HALDIRAM_DEALERS.map(([id, name, region]) => ({
  id,
  name,
  contactName: "",
  phone: "",
  region,
  isActive: true,
}));

export const collectionBags: CollectionBag[] = [];
export const countLines: CountLine[] = [];
export const sortedBags: SortedBag[] = [];
export const dispatches: Dispatch[] = [];
export const records: DamageRecord[] = [];

// Nikhil and Debu run the godown; the admin owns the business. Change the
// PINs after the first sign-in.
export const users: UserAccount[] = [
  { id: "u1", name: "Somil", email: "somil@freshtrack.app", role: "admin", isActive: true, lastActive: "", pin: "0000" },
  { id: "u2", name: "Nikhil", email: "nikhil@freshtrack.app", role: "manager", isActive: true, lastActive: "", pin: "1111" },
  { id: "u3", name: "Debu", email: "debu@freshtrack.app", role: "manager", isActive: true, lastActive: "", pin: "2222" },
];
