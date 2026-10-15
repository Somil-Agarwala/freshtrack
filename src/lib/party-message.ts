import { dayMonth, longDate, num } from "./format";
import type { Lang } from "./i18n";
import type { CollectionBag, Company, CountLine, Distributor, Product } from "@/types";

/**
 * One WhatsApp message to a party covering ALL the bags they sent that have
 * been counted -- whether the bags were logged as one pickup, as several,
 * or entered directly -- with the items and pieces added up across them.
 */

/** A party's bags: counted and not yet reported, counted and reported, and not yet counted. */
export function partyBags(partyId: string, collections: CollectionBag[]) {
  const theirs = collections.filter((c) => c.distributorId === partyId);
  const counted = theirs.filter((c) => c.status !== "uncounted");
  return {
    unsent: counted.filter((c) => !c.partyNotified),
    sent: counted.filter((c) => c.partyNotified),
    uncounted: theirs.filter((c) => c.status === "uncounted"),
  };
}

/** Parties with counted bags not yet reported to them, most bags first. */
export function partiesToMessage(collections: CollectionBag[]) {
  const byParty = new Map<string, number>();
  collections.forEach((c) => {
    if (c.status !== "uncounted" && !c.partyNotified) byParty.set(c.distributorId, (byParty.get(c.distributorId) ?? 0) + 1);
  });
  return Array.from(byParty, ([partyId, bags]) => ({ partyId, bags })).sort((a, b) => b.bags - a.bags);
}

export interface ReceivedItem {
  product?: Product;
  productId: string;
  companyId: string;
  mrp: number;
  pieces: number;
}

/** What was received in these bags, added up item by item, in the product list's order. */
export function receivedItems(bags: CollectionBag[], countLines: CountLine[], products: Product[]): ReceivedItem[] {
  const ids = new Set(bags.map((c) => c.id));
  const byItem = new Map<string, ReceivedItem>();
  countLines
    .filter((l) => ids.has(l.collectionId))
    .forEach((l) => {
      const key = `${l.productId}:${l.mrp}`;
      const row = byItem.get(key) ?? { product: products.find((p) => p.id === l.productId), productId: l.productId, companyId: l.companyId, mrp: l.mrp, pieces: 0 };
      row.pieces += l.quantity;
      byItem.set(key, row);
    });
  const order = new Map(products.map((p, i) => [p.id, i]));
  return Array.from(byItem.values()).sort((a, b) => (order.get(a.productId) ?? 1e9) - (order.get(b.productId) ?? 1e9) || a.mrp - b.mrp);
}

/** "on Tuesday, 6 October" or "between 6 October and 12 October". */
function whenText(bags: CollectionBag[], lang: Lang) {
  const dates = bags.map((b) => b.collectedDate).filter(Boolean).sort();
  if (dates.length === 0) return "";
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === last) return lang === "hi" ? `${longDate(first, lang)} को` : `on ${longDate(first, lang)}`;
  return lang === "hi" ? `${dayMonth(first, lang)} से ${dayMonth(last, lang)} के बीच` : `between ${dayMonth(first, lang)} and ${dayMonth(last, lang)}`;
}

/**
 * The message: what we received from the party, item by item and in total.
 * Nothing internal -- no bag numbers, claim rates or factory details.
 */
export function partyDamageMessage({
  party,
  companies,
  bags,
  items,
  lang,
  withValue,
}: {
  party?: Distributor;
  companies: Company[];
  bags: CollectionBag[];
  items: ReceivedItem[];
  lang: Lang;
  withValue: boolean;
}): string {
  const hi = lang === "hi";
  const pieces = items.reduce((s, i) => s + i.pieces, 0);
  const value = items.reduce((s, i) => s + i.pieces * i.mrp, 0);
  const companyIds = Array.from(new Set(items.map((i) => i.companyId)));
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "";
  const oneCompany = companyIds.length === 1 ? companyName(companyIds[0]) : "";
  const bagText = hi ? `${bags.length} बैग` : `${bags.length} bag${bags.length === 1 ? "" : "s"}`;
  const name = (i: ReceivedItem) => i.product?.name ?? (hi ? "सामान" : "Item");
  const line = (i: ReceivedItem) =>
    `• ${name(i)}${/₹\s?\d/.test(name(i)) ? "" : ` (MRP ₹${i.mrp})`} — ${num(i.pieces)} ${hi ? "पीस" : "pcs"}${withValue ? ` (₹${num(i.pieces * i.mrp)})` : ""}`;

  const body =
    companyIds.length > 1
      ? companyIds.flatMap((id, n) => [...(n ? [""] : []), `_${companyName(id)}_`, ...items.filter((i) => i.companyId === id).map(line)])
      : items.map(line);

  return [
    hi ? `नमस्ते ${party?.name ?? ""} जी,` : `Hello ${party?.name ?? ""},`,
    "",
    hi
      ? `${whenText(bags, lang)} आपसे आए ${oneCompany ? `${oneCompany} के ` : ""}${bagText} का डैमेज/एक्सपायरी माल गिन लिया गया है।`
      : `We have counted the ${bagText} of damaged/expired ${oneCompany ? `${oneCompany} ` : ""}goods received from you ${whenText(bags, lang)}.`,
    "",
    hi ? "*मिला माल:*" : "*Goods received:*",
    ...body,
    "",
    hi ? `*कुल: ${num(pieces)} पीस*${withValue ? ` · MRP से ₹${num(value)}` : ""}` : `*Total: ${num(pieces)} pieces*${withValue ? ` · ₹${num(value)} at MRP` : ""}`,
    "",
    hi ? "कोई फ़र्क लगे तो बताएँ। धन्यवाद।" : "Please let us know if anything differs. Thank you.",
  ].join("\n");
}
