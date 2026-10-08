import { BAG_CAPACITY, fillBagContents } from "../bag-packing";
import type { CollectionBag, CountLine, Dispatch, Distributor, Product, SortedBag } from "@/types";
import { HALDIRAM_CLAIM_16082026 as SHEET } from "./haldiram-claim-16082026";

/**
 * Turns Haldiram's claim sheet of 16 Aug 2026 into the app's own records,
 * so it reads like any pickup that went through the app:
 *
 *   one counted pickup bag per party (the sheet lists counted pieces per
 *   party) -> its pieces packed into 700-piece bags by MRP -> one dispatch
 *   to Haldiram, with what Haldiram passed on 29 Aug recorded as received.
 *
 * Pickup and count dates are the sheet's date; the sheet does not say when
 * each party's goods were collected.
 */
const COMPANY = "co2";
const r2 = (n: number) => Math.round(n * 100) / 100;

export const haldiramProducts: Product[] = SHEET.products.map(([id, name, category, mrp, rate]) => ({
  id,
  companyId: COMPANY,
  sku: `HLD-${id.slice(3).toUpperCase()}`,
  name,
  category,
  unit: "pack",
  mrp,
  // The sheet's RATE is what Haldiram pays per damaged piece.
  costPrice: rate,
  claimRate: rate,
  isActive: true,
}));

export const haldiramParties: Distributor[] = SHEET.parties.map(([id, name, region]) => ({
  id,
  name,
  contactName: "",
  phone: "",
  region,
  isActive: true,
}));

const partyIndex = new Map(SHEET.parties.map(([id], i) => [id, i]));
const collectionId = (partyId: string) => `hc-${partyId.slice(3)}`;

export const haldiramCollections: CollectionBag[] = SHEET.parties.map(([id], i) => ({
  id: collectionId(id),
  bagNumber: `HLD-COL-2026-${String(i + 1).padStart(4, "0")}`,
  companyId: COMPANY,
  distributorId: id,
  collectedDate: SHEET.claimDate,
  countedDate: SHEET.claimDate,
  status: "packed",
  notes: `Haldiram claim sheet ${SHEET.sheet}`,
}));

const rate = new Map(SHEET.products.map(([id, , , mrp, r]) => [id, { mrp, rate: r }]));

export const haldiramCountLines: CountLine[] = SHEET.lines
  // Sheet order: party by party, product by product. Ids carry that order,
  // which is the order the pieces go into bags.
  .slice()
  .sort((a, b) => (partyIndex.get(a[0]) ?? 0) - (partyIndex.get(b[0]) ?? 0))
  .map(([partyId, productId, quantity], i) => ({
    id: `hcl-${String(i + 1).padStart(4, "0")}`,
    collectionId: collectionId(partyId),
    companyId: COMPANY,
    productId,
    mrp: rate.get(productId)!.mrp,
    rate: rate.get(productId)!.rate,
    quantity,
    packed: true,
  }));

export const HALDIRAM_DISPATCH_ID = "hld-dsp-16082026";

function packBags(): SortedBag[] {
  const year = Number(SHEET.claimDate.slice(0, 4));
  const tiers = Array.from(new Set(haldiramCountLines.map((l) => l.mrp))).sort((a, b) => a - b);
  const empty: SortedBag[] = [];
  let seq = 0;
  tiers.forEach((mrp) => {
    let pieces = haldiramCountLines.filter((l) => l.mrp === mrp).reduce((s, l) => s + l.quantity, 0);
    while (pieces > 0) {
      const pieceCount = Math.min(BAG_CAPACITY, pieces);
      seq += 1;
      empty.push({
        id: `hsb-${seq}`,
        bagNumber: `HLD-M${mrp}-${year}-${String(seq).padStart(4, "0")}`,
        companyId: COMPANY,
        mrp,
        pieceCount,
        isFull: pieceCount === BAG_CAPACITY,
        createdDate: SHEET.claimDate,
        status: "dispatched",
        dispatchId: HALDIRAM_DISPATCH_ID,
        sourceCollectionIds: [],
      });
      pieces -= pieceCount;
    }
  });
  const collectedOn = new Map(haldiramCollections.map((c) => [c.id, c.collectedDate]));
  return fillBagContents(empty, haldiramCountLines, collectedOn);
}

export const haldiramSortedBags: SortedBag[] = packBags();

const claimed = r2(SHEET.parties.reduce((s, p) => s + p[3], 0));
const passed = r2(SHEET.parties.reduce((s, p) => s + p[4], 0));

export const haldiramDispatch: Dispatch = {
  id: HALDIRAM_DISPATCH_ID,
  dispatchNumber: "HLD-DSP-2026-0001",
  companyId: COMPANY,
  sentDate: SHEET.claimDate,
  bagCount: haldiramSortedBags.length,
  pieceCount: haldiramCountLines.reduce((s, l) => s + l.quantity, 0),
  // The sheet's own totals, to the paisa, rather than re-adding the bags.
  claimedValue: claimed,
  receivedValue: passed,
  status: passed < claimed ? "partially_settled" : "settled",
  settledDate: SHEET.passedDate,
  notes: `Haldiram claim sheet ${SHEET.sheet}. Passed ${((passed / claimed) * 100).toFixed(1)}% on 29 Aug 2026.`,
  partyShares: SHEET.parties.map(([id, , , total]) => ({
    distributorId: id,
    pieces: haldiramCountLines.filter((l) => l.collectionId === collectionId(id)).reduce((s, l) => s + l.quantity, 0),
    value: total,
  })),
};
