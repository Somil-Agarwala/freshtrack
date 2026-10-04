import type {
  CollectionBag,
  Company,
  CountLine,
  DamageRecord,
  Dispatch,
  Distributor,
  Product,
  SortedBag,
  UserAccount,
} from "@/types";

// Dates are generated relative to "today" so sample data always looks
// current, however long after cloning this someone runs it.
function daysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const companies: Company[] = [
  { id: "co1", name: "Cadbury", code: "CAD", claimContact: "Regional Claims Desk", isActive: true },
  { id: "co2", name: "Haldirams", code: "HLD", claimContact: "Depot Claims Officer", isActive: true },
  { id: "co3", name: "Unicharm", code: "UNI", claimContact: "Area Sales Manager", isActive: true },
  { id: "co4", name: "Red Bull", code: "RBL", claimContact: "Trade Marketing", isActive: true },
  { id: "co5", name: "Lotte", code: "LOT", isActive: true },
  { id: "co6", name: "Link", code: "LNK", isActive: true },
];

export const products: Product[] = [
  { id: "p1", companyId: "co1", sku: "FG-BISC-003", name: "Glucose Biscuits 60g", category: "Biscuits", unit: "pack", mrp: 10, costPrice: 8, isActive: true },
  { id: "p2", companyId: "co2", sku: "FG-NMKN-004", name: "Aloo Bhujia 42g", category: "Namkeen", unit: "pack", mrp: 10, costPrice: 8, isActive: true },
  { id: "p3", companyId: "co1", sku: "FG-CHOC-011", name: "Milk Chocolate Bar 22g", category: "Confectionery", unit: "bar", mrp: 10, costPrice: 8, isActive: true },
  { id: "p4", companyId: "co3", sku: "FG-SOAP-005", name: "Herbal Bathing Soap 100g", category: "Personal Care", unit: "piece", mrp: 20, costPrice: 16, isActive: true },
  { id: "p5", companyId: "co2", sku: "FG-NMKN-012", name: "Mixture Namkeen 100g", category: "Namkeen", unit: "pack", mrp: 20, costPrice: 16, isActive: true },
  { id: "p6", companyId: "co5", sku: "FG-CAND-013", name: "Toffee Jar Pack", category: "Confectionery", unit: "piece", mrp: 5, costPrice: 4, isActive: true },
  { id: "p7", companyId: "co3", sku: "FG-DET-006", name: "Detergent Bar 250g", category: "Home Care", unit: "bar", mrp: 30, costPrice: 24, isActive: true },
  { id: "p8", companyId: "co3", sku: "FG-SHMP-008", name: "Shampoo Sachet 6ml", category: "Personal Care", unit: "sachet", mrp: 5, costPrice: 4, isActive: true },
  { id: "p9", companyId: "co2", sku: "FG-TEA-007", name: "CTC Tea 50g", category: "Beverages", unit: "pack", mrp: 30, costPrice: 24, isActive: true },
  { id: "p10", companyId: "co4", sku: "FG-OIL-001", name: "Sunflower Oil 1L Pouch", category: "Edible Oil", unit: "pouch", mrp: 145, costPrice: 132, isActive: false },
  { id: "p11", companyId: "co1", sku: "FG-WAFR-014", name: "Choco Wafer 15g", category: "Confectionery", unit: "piece", mrp: 5, costPrice: 4, isActive: true },
  { id: "p12", companyId: "co1", sku: "FG-FRUT-015", name: "Fruit Bar 38g", category: "Confectionery", unit: "bar", mrp: 20, costPrice: 16, isActive: true },
  { id: "p13", companyId: "co1", sku: "FG-GEMS-016", name: "Gems Pack 9g", category: "Confectionery", unit: "pack", mrp: 5, costPrice: 4, isActive: true },
  { id: "p14", companyId: "co1", sku: "FG-DARK-017", name: "Dark Choco Bar 60g", category: "Confectionery", unit: "bar", mrp: 30, costPrice: 24, isActive: true },
  { id: "p15", companyId: "co2", sku: "FG-NMKN-018", name: "Moong Dal 40g", category: "Namkeen", unit: "pack", mrp: 5, costPrice: 4, isActive: true },
  { id: "p16", companyId: "co5", sku: "FG-PIE-019", name: "Choco Pie 28g", category: "Confectionery", unit: "piece", mrp: 10, costPrice: 8, isActive: true },
  { id: "p17", companyId: "co4", sku: "FG-ENRG-020", name: "Energy Drink 250ml", category: "Beverages", unit: "can", mrp: 125, costPrice: 110, isActive: true },
  { id: "p18", companyId: "co6", sku: "FG-PEN-021", name: "Glycer Ball Pen", category: "Stationery", unit: "piece", mrp: 10, costPrice: 8, isActive: true },
];

export const distributors: Distributor[] = [
  { id: "d1", name: "Ganga Traders", contactName: "Rakesh Singh", phone: "+91 98XXX XX101", region: "Lakhimpur City", isActive: true },
  { id: "d2", name: "Purvanchal Distributors", contactName: "Anita Verma", phone: "+91 98XXX XX102", region: "Lakhimpur Rural", isActive: true },
  { id: "d3", name: "Shiv Shakti Enterprises", contactName: "Manoj Tiwari", phone: "+91 98XXX XX103", region: "Sitapur", isActive: true },
  { id: "d4", name: "Awadh Wholesale Co.", contactName: "Deepak Yadav", phone: "+91 98XXX XX104", region: "Lucknow", isActive: true },
  { id: "d5", name: "Annapurna Agencies", contactName: "Suresh Pandey", phone: "+91 98XXX XX105", region: "Hardoi", isActive: false },
  { id: "d6", name: "Vindhya Sales Corp", contactName: "Ritu Sharma", phone: "+91 98XXX XX106", region: "Sitapur", isActive: true },
];

// Numbers run per company in pickup order, exactly as the app issues them.
export const collectionBags: CollectionBag[] = [
  // Packed and sent / packed and waiting to be sent.
  { id: "c1", bagNumber: "CAD-COL-2026-0001", companyId: "co1", distributorId: "d1", collectedDate: daysFromNow(-18), status: "packed", countedDate: daysFromNow(-15) },
  { id: "c2", bagNumber: "CAD-COL-2026-0002", companyId: "co1", distributorId: "d3", collectedDate: daysFromNow(-16), status: "packed", countedDate: daysFromNow(-14) },
  { id: "c10", bagNumber: "CAD-COL-2026-0003", companyId: "co1", distributorId: "d1", collectedDate: daysFromNow(-14), status: "packed", countedDate: daysFromNow(-12) },
  { id: "c11", bagNumber: "HLD-COL-2026-0001", companyId: "co2", distributorId: "d3", collectedDate: daysFromNow(-20), status: "packed", countedDate: daysFromNow(-17) },
  { id: "c12", bagNumber: "UNI-COL-2026-0001", companyId: "co3", distributorId: "d4", collectedDate: daysFromNow(-24), status: "packed", countedDate: daysFromNow(-20) },
  { id: "c13", bagNumber: "LOT-COL-2026-0001", companyId: "co5", distributorId: "d6", collectedDate: daysFromNow(-15), status: "packed", countedDate: daysFromNow(-13) },

  // Counted; their pieces are lying in the piles.
  { id: "c3", bagNumber: "CAD-COL-2026-0004", companyId: "co1", distributorId: "d2", collectedDate: daysFromNow(-9), status: "counted", countedDate: daysFromNow(-6), estimatedPieces: 880 },
  { id: "c8", bagNumber: "CAD-COL-2026-0007", companyId: "co1", distributorId: "d1", collectedDate: daysFromNow(-5), status: "counted", countedDate: daysFromNow(-3), estimatedPieces: 1100 },
  { id: "c4", bagNumber: "HLD-COL-2026-0004", companyId: "co2", distributorId: "d4", collectedDate: daysFromNow(-7), status: "counted", countedDate: daysFromNow(-5), estimatedPieces: 1000 },
  { id: "c9", bagNumber: "HLD-COL-2026-0005", companyId: "co2", distributorId: "d1", collectedDate: daysFromNow(-6), status: "counted", countedDate: daysFromNow(-4) },

  // Still sealed, waiting to be counted.
  { id: "c20", bagNumber: "HLD-COL-2026-0002", companyId: "co2", distributorId: "d4", collectedDate: daysFromNow(-10), status: "uncounted", estimatedPieces: 450 },
  { id: "c14", bagNumber: "CAD-COL-2026-0005", companyId: "co1", distributorId: "d1", collectedDate: daysFromNow(-9), status: "uncounted", estimatedPieces: 600 },
  { id: "c15", bagNumber: "HLD-COL-2026-0003", companyId: "co2", distributorId: "d3", collectedDate: daysFromNow(-8), status: "uncounted", estimatedPieces: 350 },
  { id: "c19", bagNumber: "LOT-COL-2026-0002", companyId: "co5", distributorId: "d6", collectedDate: daysFromNow(-7), status: "uncounted", estimatedPieces: 300 },
  { id: "c16", bagNumber: "CAD-COL-2026-0006", companyId: "co1", distributorId: "d2", collectedDate: daysFromNow(-6), status: "uncounted" },
  { id: "c21", bagNumber: "CAD-COL-2026-0008", companyId: "co1", distributorId: "d3", collectedDate: daysFromNow(-5), status: "uncounted", estimatedPieces: 380 },
  { id: "c5", bagNumber: "UNI-COL-2026-0002", companyId: "co3", distributorId: "d6", collectedDate: daysFromNow(-4), status: "uncounted", estimatedPieces: 600, notes: "Two sealed cartons, not opened yet." },
  { id: "c17", bagNumber: "UNI-COL-2026-0003", companyId: "co3", distributorId: "d4", collectedDate: daysFromNow(-3), status: "uncounted", estimatedPieces: 420 },
  { id: "c6", bagNumber: "HLD-COL-2026-0006", companyId: "co2", distributorId: "d1", collectedDate: daysFromNow(-2), status: "uncounted", estimatedPieces: 900 },
  { id: "c7", bagNumber: "CAD-COL-2026-0009", companyId: "co1", distributorId: "d3", collectedDate: daysFromNow(-1), status: "uncounted" },
  { id: "c18", bagNumber: "CAD-COL-2026-0010", companyId: "co1", distributorId: "d1", collectedDate: daysFromNow(0), status: "uncounted", estimatedPieces: 500 },
];

export const countLines: CountLine[] = [
  // c1 and c2 (Cadbury) are already packed into the dispatched bags below.
  { id: "cl1", collectionId: "c1", companyId: "co1", productId: "p1", mrp: 10, quantity: 820, packed: true },
  { id: "cl2", collectionId: "c1", companyId: "co1", productId: "p3", mrp: 10, quantity: 540, packed: true },
  { id: "cl3", collectionId: "c2", companyId: "co1", productId: "p3", mrp: 10, quantity: 610, packed: true },
  { id: "cl4", collectionId: "c2", companyId: "co1", productId: "p1", mrp: 10, quantity: 430, packed: true },
  // Packed into the bags that are tied and waiting for the factory.
  { id: "cl10", collectionId: "c10", companyId: "co1", productId: "p1", mrp: 10, quantity: 1200, packed: true },
  { id: "cl11", collectionId: "c10", companyId: "co1", productId: "p3", mrp: 10, quantity: 900, packed: true },
  { id: "cl12", collectionId: "c10", companyId: "co1", productId: "p12", mrp: 20, quantity: 1400, packed: true },
  { id: "cl13", collectionId: "c10", companyId: "co1", productId: "p14", mrp: 30, quantity: 420, packed: true },
  { id: "cl14", collectionId: "c11", companyId: "co2", productId: "p2", mrp: 10, quantity: 2800, packed: true },
  { id: "cl15", collectionId: "c12", companyId: "co3", productId: "p4", mrp: 20, quantity: 1400, packed: true },
  { id: "cl16", collectionId: "c12", companyId: "co3", productId: "p8", mrp: 5, quantity: 700, packed: true },
  { id: "cl17", collectionId: "c13", companyId: "co5", productId: "p6", mrp: 5, quantity: 1400, packed: true },
  // Counted but not yet tied: these are the piles. Cadbury and Haldirams
  // both have ₹10 pieces, which must never pool across the two companies.
  { id: "cl5", collectionId: "c3", companyId: "co1", productId: "p1", mrp: 10, quantity: 460, packed: false },
  { id: "cl6", collectionId: "c3", companyId: "co1", productId: "p3", mrp: 10, quantity: 380, packed: false },
  { id: "cl18", collectionId: "c3", companyId: "co1", productId: "p12", mrp: 20, quantity: 300, packed: false },
  { id: "cl19", collectionId: "c3", companyId: "co1", productId: "p11", mrp: 5, quantity: 142, packed: false },
  { id: "cl20", collectionId: "c3", companyId: "co1", productId: "p14", mrp: 30, quantity: 95, packed: false },
  { id: "cl21", collectionId: "c8", companyId: "co1", productId: "p1", mrp: 10, quantity: 420, packed: false },
  { id: "cl22", collectionId: "c8", companyId: "co1", productId: "p3", mrp: 10, quantity: 280, packed: false },
  { id: "cl23", collectionId: "c8", companyId: "co1", productId: "p12", mrp: 20, quantity: 360, packed: false },
  { id: "cl24", collectionId: "c8", companyId: "co1", productId: "p13", mrp: 5, quantity: 100, packed: false },
  { id: "cl7", collectionId: "c4", companyId: "co2", productId: "p2", mrp: 10, quantity: 520, packed: false },
  { id: "cl8", collectionId: "c4", companyId: "co2", productId: "p5", mrp: 20, quantity: 290, packed: false },
  { id: "cl9", collectionId: "c4", companyId: "co2", productId: "p9", mrp: 30, quantity: 240, packed: false },
  { id: "cl25", collectionId: "c9", companyId: "co2", productId: "p2", mrp: 10, quantity: 200, packed: false },
  { id: "cl26", collectionId: "c9", companyId: "co2", productId: "p15", mrp: 5, quantity: 110, packed: false },
];

const bag = (
  id: string,
  bagNumber: string,
  companyId: string,
  mrp: number,
  pieceCount: number,
  createdOffset: number,
  sourceCollectionIds: string[],
  dispatchId?: string
): SortedBag => ({
  id,
  bagNumber,
  companyId,
  mrp,
  pieceCount,
  isFull: pieceCount === 700,
  createdDate: daysFromNow(createdOffset),
  status: dispatchId ? "dispatched" : "ready",
  dispatchId,
  sourceCollectionIds,
});

export const sortedBags: SortedBag[] = [
  bag("sb1", "CAD-M10-2026-0001", "co1", 10, 700, -13, ["c1", "c2"], "dp1"),
  bag("sb2", "CAD-M10-2026-0002", "co1", 10, 700, -13, ["c1", "c2"], "dp1"),
  bag("sb3", "CAD-M10-2026-0003", "co1", 10, 700, -13, ["c1", "c2"], "dp1"),
  bag("sb4", "CAD-M10-2026-0004", "co1", 10, 300, -13, ["c1", "c2"], "dp1"),
  // Tied and waiting for the factory run.
  bag("sb5", "CAD-M10-2026-0005", "co1", 10, 700, -11, ["c10"]),
  bag("sb6", "CAD-M10-2026-0006", "co1", 10, 700, -11, ["c10"]),
  bag("sb7", "CAD-M10-2026-0007", "co1", 10, 700, -11, ["c10"]),
  bag("sb8", "CAD-M20-2026-0008", "co1", 20, 700, -11, ["c10"]),
  bag("sb9", "CAD-M20-2026-0009", "co1", 20, 700, -11, ["c10"]),
  bag("sb10", "CAD-M30-2026-0010", "co1", 30, 420, -11, ["c10"]),
  bag("sb11", "HLD-M10-2026-0001", "co2", 10, 700, -16, ["c11"]),
  bag("sb12", "HLD-M10-2026-0002", "co2", 10, 700, -16, ["c11"]),
  bag("sb13", "HLD-M10-2026-0003", "co2", 10, 700, -16, ["c11"]),
  bag("sb14", "HLD-M10-2026-0004", "co2", 10, 700, -16, ["c11"]),
  bag("sb15", "UNI-M20-2026-0001", "co3", 20, 700, -18, ["c12"]),
  bag("sb16", "UNI-M20-2026-0002", "co3", 20, 700, -18, ["c12"]),
  bag("sb17", "UNI-M5-2026-0003", "co3", 5, 700, -18, ["c12"]),
  bag("sb18", "LOT-M5-2026-0001", "co5", 5, 700, -12, ["c13"]),
  bag("sb19", "LOT-M5-2026-0002", "co5", 5, 700, -12, ["c13"]),
];

export const dispatches: Dispatch[] = [
  // Current cycle.
  {
    id: "dp1",
    dispatchNumber: "CAD-DSP-2026-0001",
    companyId: "co1",
    sentDate: daysFromNow(-12),
    bagCount: 4,
    pieceCount: 2400,
    claimedValue: 24000,
    receivedValue: 21600,
    status: "partially_settled",
    settledDate: daysFromNow(-3),
  },
  { id: "dp7", dispatchNumber: "CAD-DSP-2026-0003", companyId: "co1", sentDate: daysFromNow(-8), bagCount: 5, pieceCount: 3300, claimedValue: 34500, status: "under_review" },
  { id: "dp8", dispatchNumber: "HLD-DSP-2026-0003", companyId: "co2", sentDate: daysFromNow(-52), bagCount: 18, pieceCount: 8840, claimedValue: 88400, status: "under_review" },
  { id: "dp9", dispatchNumber: "UNI-DSP-2026-0002", companyId: "co3", sentDate: daysFromNow(-34), bagCount: 12, pieceCount: 6400, claimedValue: 112000, receivedValue: 80000, status: "partially_settled", settledDate: daysFromNow(-2) },
  { id: "dp10", dispatchNumber: "RBL-DSP-2026-0002", companyId: "co4", sentDate: daysFromNow(-41), bagCount: 1, pieceCount: 480, claimedValue: 60000, status: "sent" },
  { id: "dp11", dispatchNumber: "LOT-DSP-2026-0001", companyId: "co5", sentDate: daysFromNow(-12), bagCount: 6, pieceCount: 3900, claimedValue: 35000, status: "sent" },
  // Earlier cycles. Bags from these were deleted once the claim settled,
  // so these rows carry the history on their own.
  { id: "dp2", dispatchNumber: "HLD-DSP-2026-0001", companyId: "co2", sentDate: daysFromNow(-34), bagCount: 6, pieceCount: 3800, claimedValue: 41000, receivedValue: 41000, status: "settled", settledDate: daysFromNow(-22) },
  { id: "dp3", dispatchNumber: "CAD-DSP-2026-0002", companyId: "co1", sentDate: daysFromNow(-62), bagCount: 9, pieceCount: 5900, claimedValue: 62500, receivedValue: 55200, status: "partially_settled", settledDate: daysFromNow(-48) },
  { id: "dp4", dispatchNumber: "UNI-DSP-2026-0001", companyId: "co3", sentDate: daysFromNow(-88), bagCount: 3, pieceCount: 1750, claimedValue: 33500, receivedValue: 33500, status: "settled", settledDate: daysFromNow(-71) },
  { id: "dp5", dispatchNumber: "HLD-DSP-2026-0002", companyId: "co2", sentDate: daysFromNow(-119), bagCount: 7, pieceCount: 4550, claimedValue: 48200, receivedValue: 44100, status: "partially_settled", settledDate: daysFromNow(-102) },
  { id: "dp6", dispatchNumber: "RBL-DSP-2026-0001", companyId: "co4", sentDate: daysFromNow(-145), bagCount: 2, pieceCount: 1200, claimedValue: 28800, receivedValue: 0, status: "rejected", settledDate: daysFromNow(-130) },
];

export const records: DamageRecord[] = [
  { companyId: "co4", id: "r1", date: daysFromNow(-2), source: "own_inventory", productId: "p10", batchNumber: "B26-1091", quantity: 40, unit: "pouches", reason: "damaged_in_transit", costValue: 5280, status: "pending_review", responsibleParty: "Warehouse Team", hasPhoto: true },
  { companyId: "co3", id: "r2", date: daysFromNow(-1), source: "own_inventory", productId: "p7", batchNumber: "B26-1102", quantity: 25, unit: "bars", reason: "water_damage", costValue: 600, status: "written_off", responsibleParty: "Warehouse Team", hasPhoto: true },
  { companyId: "co1", id: "r3", date: daysFromNow(-5), source: "distributor", distributorId: "d1", productId: "p1", batchNumber: "B26-0872", quantity: 120, unit: "packs", reason: "returned_by_distributor", costValue: 960, status: "under_investigation", responsibleParty: "Ganga Traders", hasPhoto: true },
  { companyId: "co2", id: "r4", date: daysFromNow(-7), source: "own_inventory", productId: "p9", batchNumber: "B26-0990", quantity: 60, unit: "packs", reason: "expired", costValue: 1440, status: "returned_to_supplier", responsibleParty: "Warehouse Team", hasPhoto: false },
  { companyId: "co3", id: "r5", date: daysFromNow(-10), source: "distributor", distributorId: "d3", productId: "p4", batchNumber: "B26-0654", quantity: 30, unit: "pieces", reason: "quality_defect", costValue: 480, status: "resolved", responsibleParty: "Shiv Shakti Enterprises", hasPhoto: false },
  { companyId: "co1", id: "r6", date: daysFromNow(-12), source: "own_inventory", productId: "p1", batchNumber: "B26-0602", quantity: 90, unit: "packs", reason: "expired", costValue: 720, status: "disposed", responsibleParty: "Warehouse Team", hasPhoto: true },
  { companyId: "co2", id: "r7", date: daysFromNow(-14), source: "distributor", distributorId: "d2", productId: "p2", batchNumber: "B26-0511", quantity: 200, unit: "packs", reason: "expired", costValue: 1600, status: "disposed", responsibleParty: "Purvanchal Distributors", hasPhoto: true },
  { companyId: "co2", id: "r8", date: daysFromNow(-20), source: "own_inventory", productId: "p5", batchNumber: "B26-0410", quantity: 80, unit: "packs", reason: "packaging_damage", costValue: 1280, status: "written_off", responsibleParty: "Delivery Partner", hasPhoto: true },
];

export const users: UserAccount[] = [
  { id: "u1", name: "Somil", email: "somil@freshtrack.app", role: "admin", isActive: true, lastActive: daysFromNow(0) },
  { id: "u2", name: "Priya Nair", email: "priya@freshtrack.app", role: "manager", isActive: true, lastActive: daysFromNow(-1) },
  { id: "u3", name: "Arjun Mehta", email: "arjun@freshtrack.app", role: "data_entry", isActive: true, lastActive: daysFromNow(-2) },
  { id: "u4", name: "Kavita Rao", email: "kavita@freshtrack.app", role: "data_entry", isActive: true, lastActive: daysFromNow(-6) },
  { id: "u5", name: "Vikram Joshi", email: "vikram@freshtrack.app", role: "viewer", isActive: false, lastActive: daysFromNow(-40) },
];
