import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { BAG_CAPACITY, buildMrpTiers, pendingQuantity } from "./bag-packing";
import * as ops from "./operations";
import type { AppData } from "./operations";
import { today, yearOf } from "./utils";
import type { CollectionBag, Company, CountLine, Product } from "@/types";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const companies: Company[] = [
  { id: "co1", name: "Cadbury", code: "CAD", isActive: true },
  { id: "co2", name: "Haldirams", code: "HLD", isActive: true },
];

const products: Product[] = [
  { id: "p10", companyId: "co1", sku: "A10", name: "A", category: "x", unit: "pc", mrp: 10, costPrice: 8, isActive: true },
  { id: "p20", companyId: "co1", sku: "A20", name: "B", category: "x", unit: "pc", mrp: 20, costPrice: 16, isActive: true },
  { id: "q10", companyId: "co2", sku: "H10", name: "C", category: "x", unit: "pc", mrp: 10, costPrice: 8, isActive: true },
];

function empty(): AppData {
  return ops.initialData({
    companies,
    distributors: [
      { id: "d1", name: "Ganga Traders", contactName: "", phone: "", region: "", isActive: true },
      { id: "d2", name: "Purvanchal", contactName: "", phone: "", region: "", isActive: true },
    ],
    products,
    collections: [],
    countLines: [],
    sortedBags: [],
    dispatches: [],
    records: [],
  });
}

/** Adds one collection bag and counts it in a single step. */
function collectAndCount(
  data: AppData,
  companyId: string,
  distributorId: string,
  collectedDate: string,
  lines: { productId: string; quantity: number }[]
): { data: AppData; collection: CollectionBag } {
  const added = ops.addCollections(data, { companyId, distributorId, collectedDate }, 1);
  const collection = added.result[0];
  const counted = ops.saveCount(
    added.data,
    collection.id,
    lines.map((l) => ({ ...l, mrp: products.find((p) => p.id === l.productId)!.mrp }))
  );
  assert.equal(counted.result.ok, true);
  return { data: counted.data, collection };
}

function partyPieces(data: AppData, bagIndex: number): Record<string, number> {
  const bag = data.sortedBags[bagIndex];
  const out: Record<string, number> = {};
  bag.contents.forEach((c) => {
    const party = data.collections.find((col) => col.id === c.collectionId)!.distributorId;
    out[party] = (out[party] ?? 0) + c.quantity;
  });
  return out;
}

/** The invariants that must hold after ANY sequence of operations. */
function assertConsistent(data: AppData, everIssued: Set<string>) {
  const lineById = new Map(data.countLines.map((l) => [l.id, l]));
  const inBags = new Map<string, number>();

  data.sortedBags.forEach((bag) => {
    const sum = bag.contents.reduce((s, c) => s + c.quantity, 0);
    assert.equal(sum, bag.pieceCount, `${bag.bagNumber}: contents must add up to pieceCount`);
    assert.ok(bag.pieceCount > 0 && bag.pieceCount <= BAG_CAPACITY, `${bag.bagNumber}: 1..${BAG_CAPACITY} pieces`);
    assert.equal(bag.isFull, bag.pieceCount === BAG_CAPACITY, `${bag.bagNumber}: isFull flag`);
    assert.ok(bag.bagNumber.includes(`-M${bag.mrp}-`), `${bag.bagNumber}: carries its MRP`);
    bag.contents.forEach((c) => {
      const line = lineById.get(c.countLineId);
      assert.ok(line, `${bag.bagNumber}: points at a count line that exists`);
      assert.equal(line.companyId, bag.companyId, `${bag.bagNumber}: never mixes companies`);
      assert.equal(line.mrp, bag.mrp, `${bag.bagNumber}: never mixes MRPs`);
      inBags.set(c.countLineId, (inBags.get(c.countLineId) ?? 0) + c.quantity);
    });
    if (bag.status === "dispatched") assert.ok(data.dispatches.some((d) => d.id === bag.dispatchId), "no orphaned dispatched bags");
    if (bag.status === "ready") assert.equal(bag.dispatchId, undefined);
  });

  data.countLines.forEach((line) => {
    assert.ok(line.packedQuantity >= 0 && line.packedQuantity <= line.quantity, "0 <= packed <= quantity");
    assert.equal(line.packedQuantity, inBags.get(line.id) ?? 0, "packedQuantity equals what the bags actually hold");
  });

  data.collections.forEach((c) => {
    assert.equal(c.status, ops.collectionStatusFrom(data.countLines.filter((l) => l.collectionId === c.id)));
  });

  const numbers = [
    ...data.collections.map((c) => c.bagNumber),
    ...data.sortedBags.map((b) => b.bagNumber),
    ...data.dispatches.map((d) => d.dispatchNumber),
  ];
  assert.equal(new Set(numbers).size, numbers.length, "no duplicate numbers");
  numbers.forEach((n) => everIssued.add(n));
}

/* ------------------------------------------------------------------ */
/* Packing                                                             */
/* ------------------------------------------------------------------ */

describe("packing", () => {
  it("pools parties within a company and MRP, oldest first, with exact contents", () => {
    let data = empty();
    // README example: Ganga 900 at MRP 10, Purvanchal 750 at MRP 10 -> 700 + 700 + 250.
    data = collectAndCount(data, "co1", "d1", "2026-03-01", [{ productId: "p10", quantity: 900 }]).data;
    data = collectAndCount(data, "co1", "d2", "2026-03-05", [{ productId: "p10", quantity: 750 }]).data;

    const { data: packed, result } = ops.pack(data, {});
    assert.deepEqual(result, { bagCount: 3, pieceCount: 1650 });
    assert.deepEqual(packed.sortedBags.map((b) => b.pieceCount), [700, 700, 250]);
    assert.deepEqual(packed.sortedBags.map((b) => b.isFull), [true, true, false]);

    // The older collection (Ganga) is poured in first, so each bag knows
    // exactly whose pieces it holds -- not just "everyone in this tier".
    assert.deepEqual(partyPieces(packed, 0), { d1: 700 });
    assert.deepEqual(partyPieces(packed, 1), { d1: 200, d2: 500 });
    assert.deepEqual(partyPieces(packed, 2), { d2: 250 });
    assertConsistent(packed, new Set());
  });

  it("never pools across companies or MRPs", () => {
    let data = empty();
    data = collectAndCount(data, "co1", "d1", "2026-03-01", [
      { productId: "p10", quantity: 400 },
      { productId: "p20", quantity: 400 },
    ]).data;
    data = collectAndCount(data, "co2", "d1", "2026-03-01", [{ productId: "q10", quantity: 400 }]).data;

    const { data: packed } = ops.pack(data, {});
    assert.equal(packed.sortedBags.length, 3);
    const labels = packed.sortedBags.map((b) => b.bagNumber.split("-").slice(0, 2).join("-")).sort();
    assert.deepEqual(labels, ["CAD-M10", "CAD-M20", "HLD-M10"]);
    assertConsistent(packed, new Set());
  });

  it("'full bags only' keeps the remainder waiting and tops it up next time", () => {
    let data = empty();
    data = collectAndCount(data, "co1", "d1", "2026-03-01", [{ productId: "p10", quantity: 900 }]).data;
    data = collectAndCount(data, "co1", "d2", "2026-03-05", [{ productId: "p10", quantity: 750 }]).data;

    const first = ops.pack(data, {}, { fullBagsOnly: true });
    assert.deepEqual(first.result, { bagCount: 2, pieceCount: 1400 });
    assert.equal(buildMrpTiers(first.data.countLines)[0].pieces, 250, "250 stay in the queue");
    // Purvanchal's bag is partly packed, so it is still "counted", not "packed".
    assert.deepEqual(first.data.collections.map((c) => c.status).sort(), ["counted", "packed"]);

    // A new pickup arrives. The 250 older pieces go in before the new 450.
    let next = collectAndCount(first.data, "co1", "d1", "2026-03-20", [{ productId: "p10", quantity: 450 }]).data;
    next = ops.pack(next, {}, { fullBagsOnly: true }).data;
    assert.equal(next.sortedBags.length, 3);
    assert.deepEqual(partyPieces(next, 2), { d2: 250, d1: 450 });
    assert.ok(next.collections.every((c) => c.status === "packed"));
    assertConsistent(next, new Set());
  });

  it("does nothing when full-bags-only has less than one bag of pieces", () => {
    const data = collectAndCount(empty(), "co1", "d1", "2026-03-01", [{ productId: "p10", quantity: 699 }]).data;
    const out = ops.pack(data, {}, { fullBagsOnly: true });
    assert.deepEqual(out.result, { bagCount: 0, pieceCount: 0 });
    assert.equal(out.data, data);
  });
});

/* ------------------------------------------------------------------ */
/* Deletion rules                                                      */
/* ------------------------------------------------------------------ */

describe("deleting", () => {
  function packedScenario() {
    let data = empty();
    const a = collectAndCount(data, "co1", "d1", "2026-03-01", [{ productId: "p10", quantity: 900 }]);
    const b = collectAndCount(a.data, "co1", "d2", "2026-03-05", [{ productId: "p10", quantity: 750 }]);
    data = ops.pack(b.data, {}).data;
    return { data, a: a.collection, b: b.collection };
  }

  it("a ready bag returns its pieces to the queue, and its number is never reused", () => {
    const { data } = packedScenario();
    const last = data.sortedBags[2];
    const del = ops.deleteSortedBags(data, [last.id]);
    assert.deepEqual(del.result, { deleted: 1, skippedDispatched: 0, piecesReturned: 250 });
    assert.equal(buildMrpTiers(del.data.countLines)[0].pieces, 250);
    assertConsistent(del.data, new Set());

    const repacked = ops.pack(del.data, {}).data;
    const newest = repacked.sortedBags[repacked.sortedBags.length - 1];
    assert.equal(newest.pieceCount, 250);
    assert.notEqual(newest.bagNumber, last.bagNumber, "deleted bag number must not be handed out again");
    assert.ok(newest.bagNumber.endsWith("-0004"));
  });

  it("a dispatched bag cannot be deleted on its own", () => {
    const { data } = packedScenario();
    const sent = ops.createDispatch(data, [data.sortedBags[0].id]);
    assert.equal(sent.result.ok, true);
    const del = ops.deleteSortedBags(sent.data, [sent.data.sortedBags[0].id]);
    assert.deepEqual(del.result, { deleted: 0, skippedDispatched: 1, piecesReturned: 0 });
  });

  it("an unsettled dispatch is cancelled; a settled one is cleared with its bags", () => {
    const { data } = packedScenario();
    const first = ops.createDispatch(data, [data.sortedBags[0].id]);
    assert.ok(first.result.ok);
    const second = ops.createDispatch(first.data, [data.sortedBags[1].id]);
    assert.ok(second.result.ok);
    const settled = ops.recordSettlement(second.data, second.result.dispatch.id, 1000).data;

    const out = ops.deleteDispatches(settled, [first.result.dispatch.id, second.result.dispatch.id]);
    assert.deepEqual(out.result, { cancelled: 1, cleared: 1, bagsReturned: 1, bagsRemoved: 1 });
    assert.equal(out.data.sortedBags.find((b) => b.id === data.sortedBags[0].id)?.status, "ready");
    assert.equal(out.data.sortedBags.find((b) => b.id === data.sortedBags[1].id), undefined);
    assert.equal(out.data.dispatches.length, 0);
  });

  it("a collection cannot be deleted while a sorted bag holds its pieces", () => {
    const { data, a } = packedScenario();
    const out = ops.deleteCollections(data, [a.id]);
    assert.equal(out.result.deleted, 0);
    assert.deepEqual(out.result.blocked, [a.bagNumber]);
  });

  it("a count cannot be edited once any piece is packed", () => {
    const { data, b } = packedScenario();
    const out = ops.saveCount(data, b.id, [{ productId: "p10", mrp: 10, quantity: 10 }]);
    assert.equal(out.result.ok, false);
  });
});

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

describe("dispatch", () => {
  it("refuses to mix companies in one dispatch", () => {
    let data = collectAndCount(empty(), "co1", "d1", "2026-03-01", [{ productId: "p10", quantity: 100 }]).data;
    data = collectAndCount(data, "co2", "d1", "2026-03-01", [{ productId: "q10", quantity: 100 }]).data;
    data = ops.pack(data, {}).data;
    const out = ops.createDispatch(data, data.sortedBags.map((b) => b.id));
    assert.equal(out.result.ok, false);
  });

  it("totals the claim and tracks short payment and rejection", () => {
    let data = collectAndCount(empty(), "co1", "d1", "2026-03-01", [{ productId: "p20", quantity: 1000 }]).data;
    data = ops.pack(data, {}).data;
    const sent = ops.createDispatch(data, data.sortedBags.map((b) => b.id));
    assert.ok(sent.result.ok);
    assert.equal(sent.result.dispatch.claimedValue, 20000);
    assert.equal(sent.result.dispatch.pieceCount, 1000);

    const short = ops.recordSettlement(sent.data, sent.result.dispatch.id, 18000).data;
    assert.equal(short.dispatches[0].status, "partially_settled");
    assert.equal(ops.recordSettlement(short, sent.result.dispatch.id, 20000).result, false, "cannot settle twice");

    const reviewed = ops.markDispatch(sent.data, sent.result.dispatch.id, "under_review").data;
    const rejected = ops.markDispatch(reviewed, sent.result.dispatch.id, "rejected").data;
    assert.equal(rejected.dispatches[0].status, "rejected");
    assert.equal(rejected.dispatches[0].receivedValue, 0);
  });
});

/* ------------------------------------------------------------------ */
/* Randomised: invariants survive any sequence of operations           */
/* ------------------------------------------------------------------ */

describe("invariants", () => {
  it("hold across 3,000 random operations", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

    let data = empty();
    const everIssued = new Set<string>();
    const removed = new Set<string>();
    let previous = new Set<string>();

    for (let step = 0; step < 3000; step++) {
      const roll = rand();
      if (roll < 0.3) {
        const company = pick(["co1", "co2"]);
        const own = products.filter((p) => p.companyId === company);
        const lines = own.filter(() => rand() < 0.7).map((p) => ({ productId: p.id, quantity: 1 + Math.floor(rand() * 900) }));
        if (lines.length > 0) {
          const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
          data = collectAndCount(data, company, pick(["d1", "d2"]), `2026-03-${day}`, lines).data;
        }
      } else if (roll < 0.5) {
        data = ops.pack(data, rand() < 0.5 ? {} : { companyId: pick(["co1", "co2"]) }, { fullBagsOnly: rand() < 0.5 }).data;
      } else if (roll < 0.65) {
        const ready = data.sortedBags.filter((b) => b.status === "ready" && rand() < 0.3);
        data = ops.deleteSortedBags(data, ready.map((b) => b.id)).data;
      } else if (roll < 0.8) {
        const company = pick(["co1", "co2"]);
        const ready = data.sortedBags.filter((b) => b.status === "ready" && b.companyId === company && rand() < 0.6);
        data = ops.createDispatch(data, ready.map((b) => b.id)).data;
      } else if (roll < 0.9) {
        // Cancel only: clearing a settled dispatch removes bags on purpose,
        // which the "packed equals bag contents" check does not model.
        const open = data.dispatches.filter((d) => d.status === "sent" && rand() < 0.3);
        data = ops.deleteDispatches(data, open.map((d) => d.id)).data;
      } else {
        const removable = data.collections.filter((c) => rand() < 0.1);
        data = ops.deleteCollections(data, removable.map((c) => c.id)).data;
      }

      assertConsistent(data, everIssued);

      // A number that was deleted must never be handed out again.
      const current = new Set([
        ...data.collections.map((c) => c.bagNumber),
        ...data.sortedBags.map((b) => b.bagNumber),
        ...data.dispatches.map((d) => d.dispatchNumber),
      ]);
      current.forEach((n) => assert.ok(!removed.has(n), `${n} was deleted earlier and has been reissued`));
      previous.forEach((n) => {
        if (!current.has(n)) removed.add(n);
      });
      previous = current;
    }

    assert.ok(removed.size > 0, "the run actually deleted something");

    assert.ok(data.sortedBags.length > 0, "the run actually packed something");
    const pending = data.countLines.reduce((s, l) => s + pendingQuantity(l), 0);
    assert.ok(pending >= 0);
  });
});

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

describe("dates", () => {
  it("today() uses the local calendar day, not UTC", () => {
    const previousTz = process.env.TZ;
    process.env.TZ = "Asia/Kolkata";
    // 00:30 on 1 Jan 2026 in India is still 31 Dec 2025 in UTC.
    mock.timers.enable({ apis: ["Date"], now: Date.parse("2025-12-31T19:00:00Z") });
    try {
      assert.equal(today(), "2026-01-01");
      assert.equal(yearOf(today()), 2026);
    } finally {
      mock.timers.reset();
      process.env.TZ = previousTz;
    }
  });

  it("CountLine fixtures stay honest", () => {
    const line: CountLine = { id: "x", collectionId: "c", companyId: "co1", productId: "p10", mrp: 10, quantity: 5, packedQuantity: 2 };
    assert.equal(pendingQuantity(line), 3);
  });
});
