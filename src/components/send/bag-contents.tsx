"use client";

import { num } from "@/lib/format";
import type { Product, SortedBag } from "@/types";

/** Item name for an invoice line; falls back to the SKU if the product is gone. */
function itemName(products: Product[], productId: string) {
  return products.find((p) => p.id === productId)?.name ?? productId;
}

/** "NAMKEEN 10/- 420 · CHIPS10/- 280" -- one line for a bag in a list. */
export function bagItemSummary(bag: SortedBag, products: Product[]): string {
  return (bag.items ?? []).map((i) => `${itemName(products, i.productId)} ${num(i.pieces)}`).join(" · ");
}

/**
 * The invoice's detail pages: every bag on the run, the items inside it and
 * how many pieces of each. Printed after the slip; no party names, since the
 * factory only needs what is in each bag.
 */
export function BagContentsSheet({ bags, products }: { bags: SortedBag[]; products: Product[] }) {
  const sorted = bags.slice().sort((a, b) => a.bagNumber.localeCompare(b.bagNumber));
  if (sorted.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-base font-bold">बैग में क्या है · Bag-wise contents</h2>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b-2 border-[#111418] text-left">
            <th className="py-1 pr-2 font-semibold">बैग नंबर · Bag no.</th>
            <th className="py-1 pr-2 font-semibold">MRP</th>
            <th className="py-1 pr-2 font-semibold">सामान · Item</th>
            <th className="py-1 text-right font-semibold">पीस · Pcs</th>
          </tr>
        </thead>
        {sorted.map((bag) => {
          const items = bag.items ?? [];
          const span = Math.max(1, items.length);
          return (
            // One tbody per bag so a bag is never split across two pages.
            <tbody key={bag.id} className="break-inside-avoid border-b border-[#9AA1AC]">
              {items.length === 0 ? (
                <tr>
                  <td className="py-1 pr-2 align-top">
                    <span className="font-mono font-semibold">{bag.bagNumber}</span>
                    <span className="block text-[#4A5260]">{num(bag.pieceCount)} pcs</span>
                  </td>
                  <td className="py-1 pr-2 align-top">₹{bag.mrp}</td>
                  <td className="py-1 pr-2 italic text-[#4A5260]">सामान दर्ज नहीं · Items not recorded</td>
                  <td className="py-1 text-right align-top">{num(bag.pieceCount)}</td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={item.productId}>
                    {i === 0 && (
                      <>
                        <td rowSpan={span} className="py-1 pr-2 align-top">
                          <span className="font-mono font-semibold">{bag.bagNumber}</span>
                          <span className="block text-[#4A5260]">{num(bag.pieceCount)} pcs</span>
                        </td>
                        <td rowSpan={span} className="py-1 pr-2 align-top">
                          ₹{bag.mrp}
                        </td>
                      </>
                    )}
                    <td className="py-0.5 pr-2">{itemName(products, item.productId)}</td>
                    <td className="py-0.5 text-right">{num(item.pieces)}</td>
                  </tr>
                ))
              )}
            </tbody>
          );
        })}
      </table>
    </section>
  );
}
