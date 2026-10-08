import { bagValue, lineValue } from "./claim";
import * as XLSX from "xlsx";
import * as A from "./analytics";
import type { Dataset as AnalyticsDataset } from "./analytics";
import {
  COLLECTION_STATUS_LABELS,
  REASON_LABELS,
  SORTED_BAG_STATUS_LABELS,
  STATUS_LABELS,
} from "./constants";
import { formatDate } from "./utils";
import type {
  CollectionBag,
  Company,
  CountLine,
  DamageRecord,
  Dispatch,
  Distributor,
  Product,
  SortedBag,
} from "@/types";

type Row = Record<string, string | number>;

function download(sheets: { name: string; rows: Row[] }[], filename: string) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    // An empty sheet throws in some Excel readers, so emit a placeholder row.
    const rows = sheet.rows.length > 0 ? sheet.rows : [{ Note: "No rows matched the selected filters" }];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheet.name);
  });
  XLSX.writeFile(workbook, filename);
}

interface BagExportParams {
  bags: SortedBag[];
  collections: CollectionBag[];
  countLines: CountLine[];
  distributors: Distributor[];
  products: Product[];
  companies: Company[];
  filterLabel?: string;
}

/**
 * The report carried to the factory. Sheet 1 is the manifest a person can
 * physically tick off bag by bag. Sheet 2 rolls up by MRP for the claim
 * total. Sheet 3 traces every bag back to the party it came from, which
 * is what settles disputes about whose stock was in which bag.
 */
export function exportSortedBags({ bags, collections, countLines, distributors, products, companies, filterLabel }: BagExportParams) {
  const manifest: Row[] = bags.map((bag) => {
    const parties = bag.sourceCollectionIds
      .map((id) => collections.find((c) => c.id === id))
      .map((c) => distributors.find((d) => d.id === c?.distributorId)?.name)
      .filter((name): name is string => Boolean(name));
    return {
      "Bag Number": bag.bagNumber,
      Company: companies.find((c) => c.id === bag.companyId)?.name ?? "",
      "MRP (INR)": bag.mrp,
      Pieces: bag.pieceCount,
      "Claim Value (INR)": bagValue(bag),
      "Full Bag": bag.isFull ? "Yes" : "Part-filled",
      Status: SORTED_BAG_STATUS_LABELS[bag.status],
      Created: formatDate(bag.createdDate),
      Parties: Array.from(new Set(parties)).join(", "),
    };
  });

  // Grouped by company then MRP, because each company is a separate claim.
  const byTier = new Map<string, { companyId: string; mrp: number; bags: number; pieces: number; value: number }>();
  bags.forEach((bag) => {
    const key = `${bag.companyId}::${bag.mrp}`;
    const entry = byTier.get(key) ?? { companyId: bag.companyId, mrp: bag.mrp, bags: 0, pieces: 0, value: 0 };
    entry.bags += 1;
    entry.pieces += bag.pieceCount;
    entry.value += bagValue(bag);
    byTier.set(key, entry);
  });

  const summary: Row[] = Array.from(byTier.values())
    .sort((a, b) => a.companyId.localeCompare(b.companyId) || a.mrp - b.mrp)
    .map((entry) => ({
      Company: companies.find((c) => c.id === entry.companyId)?.name ?? "",
      "MRP (INR)": entry.mrp,
      Bags: entry.bags,
      Pieces: entry.pieces,
      "Claim Value (INR)": entry.value,
    }));

  summary.push({
    Company: "TOTAL",
    "MRP (INR)": "",
    Bags: bags.length,
    Pieces: bags.reduce((sum, b) => sum + b.pieceCount, 0),
    "Claim Value (INR)": bags.reduce((sum, b) => sum + bagValue(b), 0),
  });

  const includedCollectionIds = new Set(bags.flatMap((b) => b.sourceCollectionIds));
  const traceability: Row[] = countLines
    .filter((line) => includedCollectionIds.has(line.collectionId))
    .map((line) => {
      const collection = collections.find((c) => c.id === line.collectionId);
      const distributor = distributors.find((d) => d.id === collection?.distributorId);
      const product = products.find((p) => p.id === line.productId);
      return {
        "Collection Bag": collection?.bagNumber ?? "",
        Company: companies.find((c) => c.id === line.companyId)?.name ?? "",
        Party: distributor?.name ?? "",
        Collected: collection ? formatDate(collection.collectedDate) : "",
        SKU: product?.sku ?? "",
        Product: product?.name ?? "",
        "MRP (INR)": line.mrp,
        Pieces: line.quantity,
        "Value (INR)": lineValue(line),
      };
    });

  const suffix = filterLabel ? `-${filterLabel.replace(/\s+/g, "-").toLowerCase()}` : "";
  download(
    [
      { name: "Bag Manifest", rows: manifest },
      { name: "MRP Summary", rows: summary },
      { name: "Traceability", rows: traceability },
    ],
    `bag-report${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/**
 * The manifest for one factory run, as sent to the factory: the bags, and
 * the items in each bag. Party names are left out on purpose.
 */
export function exportDispatch({
  dispatch,
  bags,
  products,
  companies,
}: {
  dispatch: Dispatch;
  bags: SortedBag[];
  products: Product[];
  companies: Company[];
}) {
  const header: Row[] = [
    { Field: "Dispatch Number", Value: dispatch.dispatchNumber },
    { Field: "Company", Value: companies.find((c) => c.id === dispatch.companyId)?.name ?? "" },
    { Field: "Sent Date", Value: formatDate(dispatch.sentDate) },
    { Field: "Total Bags", Value: dispatch.bagCount },
    { Field: "Total Pieces", Value: dispatch.pieceCount },
    { Field: "Claimed Value (INR)", Value: dispatch.claimedValue },
    { Field: "Received Value (INR)", Value: dispatch.receivedValue ?? "Not settled yet" },
  ];

  const sorted = bags.slice().sort((a, b) => a.bagNumber.localeCompare(b.bagNumber));
  const manifest: Row[] = sorted.map((bag) => ({
    "Bag Number": bag.bagNumber,
    "MRP (INR)": bag.mrp,
    Pieces: bag.pieceCount,
    "Claim Value (INR)": bagValue(bag),
  }));

  // One row per item per bag: what the factory checks each bag against.
  const contents: Row[] = sorted.flatMap((bag) =>
    bag.items?.length
      ? bag.items.map((item) => ({
          "Bag Number": bag.bagNumber,
          "MRP (INR)": bag.mrp,
          Item: products.find((p) => p.id === item.productId)?.name ?? item.productId,
          Pieces: item.pieces,
        }))
      : [{ "Bag Number": bag.bagNumber, "MRP (INR)": bag.mrp, Item: "Items not recorded", Pieces: bag.pieceCount }]
  );

  download(
    [
      { name: "Dispatch Summary", rows: header },
      { name: "Bag Manifest", rows: manifest },
      { name: "Bag Contents", rows: contents },
    ],
    `${dispatch.dispatchNumber}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/** Collection bags as currently filtered on screen. */
export function exportCollections({
  collections,
  countLines,
  distributors,
  companies,
}: {
  collections: CollectionBag[];
  countLines: CountLine[];
  distributors: Distributor[];
  companies: Company[];
}) {
  const rows: Row[] = collections.map((collection) => {
    const lines = countLines.filter((l) => l.collectionId === collection.id);
    const distributor = distributors.find((d) => d.id === collection.distributorId);
    return {
      "Bag Number": collection.bagNumber,
      Company: companies.find((c) => c.id === collection.companyId)?.name ?? "",
      Party: distributor?.name ?? "",
      Region: distributor?.region ?? "",
      Status: COLLECTION_STATUS_LABELS[collection.status],
      Collected: formatDate(collection.collectedDate),
      Counted: collection.countedDate ? formatDate(collection.countedDate) : "",
      "Estimated Pieces": collection.estimatedPieces ?? "",
      "Counted Pieces": lines.reduce((sum, l) => sum + l.quantity, 0),
      "Counted Value (INR)": lines.reduce((sum, l) => sum + lineValue(l), 0),
    };
  });

  download([{ name: "Collections", rows }], `collections-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Own-inventory damage records as currently filtered on screen. */
export function exportRecords({
  records,
  products,
  distributors,
  companies,
}: {
  records: DamageRecord[];
  products: Product[];
  distributors: Distributor[];
  companies: Company[];
}) {
  const rows: Row[] = records.map((r) => {
    const product = products.find((p) => p.id === r.productId);
    const distributor = distributors.find((d) => d.id === r.distributorId);
    return {
      Date: formatDate(r.date),
      Company: companies.find((c) => c.id === r.companyId)?.name ?? "",
      Source: r.source === "own_inventory" ? "Own Inventory" : distributor?.name ?? "Party",
      SKU: product?.sku ?? "",
      Product: product?.name ?? "",
      Batch: r.batchNumber,
      Quantity: r.quantity,
      Unit: r.unit,
      Reason: REASON_LABELS[r.reason],
      "Cost Value (INR)": r.costValue,
      Status: STATUS_LABELS[r.status],
      "Responsible Party": r.responsibleParty,
    };
  });

  download([{ name: "Damage Records", rows }], `damage-records-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/* Analytics workbook -- one sheet per section of the Analytics page.   */
/* Whatever company filter is active on screen is already applied to    */
/* the dataset passed in, so the export matches exactly what was seen.  */
/* ------------------------------------------------------------------ */

export function exportAnalytics(d: AnalyticsDataset) {
  const money = (v: number) => Math.round(v);

  const pipeline: Row[] = A.pipeline(d).map((s) => ({
    Stage: s.stage, Bags: s.bags, Pieces: s.pieces, "Value (INR)": money(s.value),
  }));

  const claims: Row[] = A.claimsByCompany(d).map((c) => ({
    Company: c.company, Dispatches: c.dispatches,
    "Claimed (INR)": money(c.claimed), "Received (INR)": money(c.received),
    "Shortfall (INR)": money(c.shortfall),
    "Recovery %": Number(c.recoveryPct.toFixed(1)),
    "Avg Settlement Days": c.avgSettlementDays ?? "",
  }));

  const parties: Row[] = A.partyBreakdown(d).map((p) => ({
    Party: p.party, Region: p.region, Bags: p.bags, Pieces: p.pieces,
    "Value (INR)": money(p.value), "Share %": Number(p.sharePct.toFixed(1)),
    "Count Variance %": p.countVariancePct == null ? "" : Number(p.countVariancePct.toFixed(1)),
  }));

  const regions: Row[] = A.regionBreakdown(d).map((r) => ({
    Region: r.region, Bags: r.bags, Pieces: r.pieces, "Value (INR)": money(r.value),
  }));

  const skus: Row[] = A.topSkus(d, 100).map((s) => ({
    SKU: s.sku, Product: s.name, Pieces: s.pieces, "Value (INR)": money(s.value),
  }));

  const categories: Row[] = A.categoryBreakdown(d).map((c) => ({
    Category: c.category, Pieces: c.pieces, "Value (INR)": money(c.value),
  }));

  const mrp: Row[] = A.mrpBreakdown(d).map((m) => ({
    "MRP (INR)": m.mrp, Pieces: m.pieces, "Bags Packed": m.bags, "Value (INR)": money(m.value),
  }));

  const f = A.bagFill(d);
  const operations: Row[] = [
    { Metric: "Bags packed", Value: f.bags },
    { Metric: "Full bags", Value: f.full },
    { Metric: "Part-filled bags", Value: f.partial },
    { Metric: "Average fill %", Value: Number(f.avgFillPct.toFixed(1)) },
    { Metric: "Unused capacity (pieces)", Value: f.wastedPieces },
    { Metric: "Mean rough-count error %", Value: Number(A.countAccuracy(d).meanAbsPct.toFixed(1)) },
  ];

  const turnaround: Row[] = A.countTurnaround(d).map((t) => ({
    Company: t.company, "Bags Counted": t.counted,
    "Avg Days To Count": t.avgDays ?? "",
    "Oldest Uncounted (days)": t.oldestPendingDays ?? "",
  }));

  const accuracy: Row[] = A.countAccuracy(d).rows.map((r) => ({
    Bag: r.bagNumber, Estimated: r.estimated, Counted: r.actual,
    Gap: r.variance, "Gap %": Number(r.variancePct.toFixed(1)),
  }));

  const ownLoss: Row[] = A.ownLossByReason(d).map((r) => ({
    Reason: r.reason, Units: r.qty, "Loss Value (INR)": money(r.value),
  }));

  const responsible: Row[] = A.ownLossByResponsible(d).map((r) => ({
    "Responsible Party": r.party, "Loss Value (INR)": money(r.value),
  }));

  const trend: Row[] = A.monthlyTrend(d).map((m) => ({
    Month: m.month, "Bags Collected": m.collectedBags, "Pieces Counted": m.countedPieces,
    "Claimed (INR)": money(m.claimed), "Received (INR)": money(m.received),
  }));

  download(
    [
      { name: "Pipeline", rows: pipeline },
      { name: "Monthly Trend", rows: trend },
      { name: "Claims", rows: claims },
      { name: "Parties", rows: parties },
      { name: "Regions", rows: regions },
      { name: "Top SKUs", rows: skus },
      { name: "Categories", rows: categories },
      { name: "MRP Tiers", rows: mrp },
      { name: "Operations", rows: operations },
      { name: "Count Turnaround", rows: turnaround },
      { name: "Count Accuracy", rows: accuracy },
      { name: "Own Loss By Reason", rows: ownLoss },
      { name: "Own Loss By Party", rows: responsible },
    ],
    `freshtrack-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
