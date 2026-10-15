import { longDate, num } from "./format";
import type { Lang } from "./i18n";
import type { CollectionBag, Company, CountLine, Distributor, Product } from "@/types";

/**
 * The bags that came in together from one party in one pickup. They share
 * the id stem (c-<stamp>-000, c-<stamp>-001, …); a direct entry is a pickup
 * of its own.
 */
export function pickupBatch(bag: CollectionBag, collections: CollectionBag[]): CollectionBag[] {
  const stem = bag.id.slice(0, bag.id.lastIndexOf("-") + 1);
  if (!stem || bag.direct) return [bag];
  return collections
    .filter((c) => c.id.startsWith(stem) && c.distributorId === bag.distributorId && !c.direct)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export interface ReceivedItem {
  product?: Product;
  productId: string;
  mrp: number;
  pieces: number;
}

/** What was received in these bags, item by item, in the product list's order. */
export function receivedItems(batch: CollectionBag[], countLines: CountLine[], products: Product[]): ReceivedItem[] {
  const ids = new Set(batch.map((c) => c.id));
  const byItem = new Map<string, ReceivedItem>();
  countLines
    .filter((l) => ids.has(l.collectionId))
    .forEach((l) => {
      const key = `${l.productId}:${l.mrp}`;
      const row = byItem.get(key) ?? { product: products.find((p) => p.id === l.productId), productId: l.productId, mrp: l.mrp, pieces: 0 };
      row.pieces += l.quantity;
      byItem.set(key, row);
    });
  const order = new Map(products.map((p, i) => [p.id, i]));
  return Array.from(byItem.values()).sort((a, b) => (order.get(a.productId) ?? 1e9) - (order.get(b.productId) ?? 1e9) || a.mrp - b.mrp);
}

/**
 * The WhatsApp message to the party: the damaged goods we received from
 * them, item by item, and the total. Nothing internal -- no bag numbers,
 * claim rates or factory details.
 */
export function partyDamageMessage({
  party,
  company,
  batch,
  items,
  lang,
  withValue,
  sender,
}: {
  party?: Distributor;
  company?: Company;
  batch: CollectionBag[];
  items: ReceivedItem[];
  lang: Lang;
  withValue: boolean;
  sender?: string;
}): string {
  const hi = lang === "hi";
  const pieces = items.reduce((s, i) => s + i.pieces, 0);
  const value = items.reduce((s, i) => s + i.pieces * i.mrp, 0);
  const date = batch[0]?.collectedDate ? longDate(batch[0].collectedDate, lang) : "";
  const bagWord = hi ? "बैग" : batch.length === 1 ? "bag" : "bags";
  const name = (i: ReceivedItem) => i.product?.name ?? (hi ? "सामान" : "Item");
  const showMrp = (i: ReceivedItem) => (/₹\s?\d/.test(name(i)) ? "" : ` (MRP ₹${i.mrp})`);

  const lines = [
    hi ? `नमस्ते ${party?.name ?? ""} जी,` : `Hello ${party?.name ?? ""},`,
    "",
    hi
      ? `${date} को आपसे आया ${company?.name ?? ""} का डैमेज/एक्सपायरी माल (${batch.length} ${bagWord}) गिन लिया गया है।`
      : `We have counted the damaged/expired ${company?.name ?? ""} goods received from you on ${date} (${batch.length} ${bagWord}).`,
    "",
    hi ? "*मिला माल:*" : "*Goods received:*",
    ...items.map((i) => `• ${name(i)}${showMrp(i)} — ${num(i.pieces)} ${hi ? "पीस" : "pcs"}${withValue ? ` (₹${num(i.pieces * i.mrp)})` : ""}`),
    "",
    hi ? `*कुल: ${num(pieces)} पीस*${withValue ? ` · MRP से ₹${num(value)}` : ""}` : `*Total: ${num(pieces)} pieces*${withValue ? ` · ₹${num(value)} at MRP` : ""}`,
    "",
    hi ? "कोई फ़र्क लगे तो बताएँ। धन्यवाद।" : "Please let us know if anything differs. Thank you.",
  ];
  if (sender) lines.push(`— ${sender}`);
  return lines.join("\n");
}
