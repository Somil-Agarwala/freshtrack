"use client";

import Link from "next/link";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { BagNumber } from "@/components/ft/bag-number";
import { MrpCircle } from "@/components/ft/brand";
import { ArrowRightIcon, CheckIcon } from "@/components/ft/icons";
import { EmptyCard } from "@/components/ft/kit";
import { BigLink, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";
import { PartyWhatsApp } from "./party-whatsapp";

/**
 * Straight after counting: what was counted, MRP by MRP, and the way to put
 * it into bags. Nothing has gone into a bag yet -- staff open "Fill the bag"
 * for each MRP and say how many pieces actually went in.
 */
export function SortGuide({ collectionId }: { collectionId: string }) {
  const { t, sub } = useLang();
  const { collections, companies, distributors, countLines, products, sortedBags } = useStore();
  const pickup = collections.find((c) => c.id === collectionId);
  const company = companies.find((c) => c.id === pickup?.companyId);

  if (!pickup || !company) {
    return (
      <Screen>
        <ScreenBody className="items-center justify-center">
          <Link href="/count" className="font-bold text-count">
            {t("गिनती की सूची देखें", "Back to the count list")}
          </Link>
        </ScreenBody>
      </Screen>
    );
  }

  const party = distributors.find((d) => d.id === pickup.distributorId);
  const mine = countLines.filter((l) => l.collectionId === pickup.id);
  const counted = mine.reduce((s, l) => s + l.quantity, 0);
  const nameOf = (productId: string) => products.find((p) => p.id === productId)?.name ?? "—";
  const byMrp = Array.from(new Set(mine.map((l) => l.mrp)))
    .sort((a, b) => a - b)
    .map((mrp) => {
      const lines = mine.filter((l) => l.mrp === mrp);
      const items = Array.from(lines.reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>()));
      return {
        mrp,
        pieces: lines.reduce((s, l) => s + l.quantity, 0),
        waiting: lines.filter((l) => !l.bagId).reduce((s, l) => s + l.quantity, 0),
        items,
        open: sortedBags.find((b) => b.status === "open" && b.companyId === company.id && b.mrp === mrp),
      };
    });
  const left = byMrp.reduce((s, r) => s + r.waiting, 0);
  const shortNumber = pickup.bagNumber.replace(/-\d{4}-/, "-");

  return (
    <Screen>
      <TaskHeader
        back={`/collections/${pickup.id}`}
        tone="pile"
        kicker={`✓ ${num(counted)} ${pickup.direct ? t("पीस डाले", "pieces entered") : t("पीस गिने", "pieces counted")} · ${shortNumber}${party ? ` · ${party.name}` : ""}`}
      >
        <h1 className="font-display text-2xl font-extrabold leading-[1.15]">{left > 0 ? t("अब माल बैग में डालें", "Now put the goods into bags") : t("सारा माल बैग में ✓", "All goods are in bags ✓")}</h1>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        {mine.length === 0 && <EmptyCard title={t("इस बैग में कुछ नहीं गिना गया", "Nothing was counted in this bag")} />}
        {left > 0 && (
          <p className="text-base leading-snug text-ink-soft">
            {t("हर MRP का माल अलग बैग में जाता है। “बैग में डालें” दबाएँ, माल डालें और जितना डाला उतना लिखें।", "Each MRP goes into its own bag. Tap “Put into bag”, put the goods in and type how many went in.")}
            <span className="mt-0.5 block text-sm text-ink-faint">{sub("हर MRP का अलग बैग", "Each MRP its own bag")}</span>
          </p>
        )}

        {byMrp.map((row) => (
          <section key={row.mrp} className={row.waiting > 0 ? "flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5" : "flex flex-col gap-2 rounded-[20px] border border-money-line bg-money-tint p-3.5"}>
            <div className="flex items-center gap-3">
              <MrpCircle mrp={row.mrp} size={52} />
              <span className="min-w-0 flex-1">
                <b className="block font-display text-xl">
                  {num(row.pieces)} {t("पीस", "pcs")}
                </b>
                <span className="block truncate text-sm text-ink-dim">{row.items.map(([id, n]) => `${nameOf(id)} ${num(n)}`).join(" · ")}</span>
              </span>
            </div>
            {row.waiting > 0 ? (
              <>
                <p className="text-[15px] text-ink-dim">
                  {row.open ? (
                    <>
                      {t("भर रहा बैग", "Bag being filled")} <BagNumber value={row.open.bagNumber} className="text-[18px] text-ink" />
                    </>
                  ) : (
                    t("इस MRP का नया बैग खुलेगा", "A new bag opens for this MRP")
                  )}
                  {row.waiting < row.pieces && ` · ${t(`${num(row.waiting)} पीस बाकी`, `${num(row.waiting)} pcs left`)}`}
                </p>
                <BigLink tone="pile" href={`/fill?company=${company.id}&mrp=${row.mrp}&from=${pickup.id}`} className="h-14 text-lg">
                  {t(`₹${row.mrp} बैग में डालें`, `Put into ₹${row.mrp} bag`)}
                  <ArrowRightIcon />
                </BigLink>
              </>
            ) : (
              <p className="flex items-center gap-2 text-base font-bold text-money-note">
                <CheckIcon size={20} className="text-money" /> {t("बैग में डाल दिया", "Put into bags")}
              </p>
            )}
          </section>
        ))}

        <PartyWhatsApp collectionId={pickup.id} />
      </ScreenBody>

      <ScreenFooter>
        {pickup.direct ? (
          <BigLink tone="count" href={`/direct?company=${company.id}`}>
            {t("अगली पार्टी का माल डालें", "Next party's goods")}
            <ArrowRightIcon />
          </BigLink>
        ) : (
          <BigLink tone="count" href="/count">
            {t("अगला बैग गिनें", "Count the next bag")}
            <ArrowRightIcon />
          </BigLink>
        )}
        <Link href={`/piles?company=${company.id}`} className="flex h-11 items-center justify-center text-base font-bold text-ink-dim">
          {t("सारे बैग देखें", "See all bags")}
        </Link>
      </ScreenFooter>
    </Screen>
  );
}
