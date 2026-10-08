"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COLLECTION_STATUS_HI, COLLECTION_STATUS_LABELS } from "@/lib/constants";
import { exportCollections } from "@/lib/export";
import { fullDate, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { CollectionStatus } from "@/types";
import { CompanyAvatar } from "@/components/ft/brand";
import { TruckIcon } from "@/components/ft/icons";
import { Chips, EmptyCard, ExportButton, Pill, SearchBox } from "@/components/ft/kit";
import { CompanyTabs, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";

export const COLLECTION_TONE: Record<CollectionStatus, "count" | "pile" | "money"> = { uncounted: "count", counted: "pile", packed: "money" };

/** Every bag ever brought in from a party, and where each one is now. */
export function AllBags({ initialSearch = "" }: { initialSearch?: string }) {
  const { t, lang } = useLang();
  const { collections, companies, distributors, countLines } = useStore();
  const [status, setStatus] = useState<"all" | CollectionStatus>("all");
  const [companyId, setCompanyId] = useState("all");
  const [query, setQuery] = useState(initialSearch);

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      collections
        .filter((c) => (status === "all" || c.status === status) && (companyId === "all" || c.companyId === companyId))
        .filter((c) => !q || c.bagNumber.toLowerCase().includes(q) || distributors.find((d) => d.id === c.distributorId)?.name.toLowerCase().includes(q))
        .sort((a, b) => b.collectedDate.localeCompare(a.collectedDate) || b.bagNumber.localeCompare(a.bagNumber)),
    [collections, distributors, status, companyId, q]
  );
  const count = (s: CollectionStatus) => collections.filter((c) => c.status === s).length;

  // Bags picked up on the same day are shown together.
  const byDay = list.reduce<{ date: string; bags: typeof list }[]>((groups, bag) => {
    const last = groups[groups.length - 1];
    if (last?.date === bag.collectedDate) last.bags.push(bag);
    else groups.push({ date: bag.collectedDate, bags: [bag] });
    return groups;
  }, []);

  return (
    <Screen width="wide">
      <ListHeader tone="pickup" icon={<TruckIcon size={26} />} title={t("सारे बैग", "All pickup bags")} subtitle={t("हर पिकअप, और अभी वो कहाँ है", "Every pickup, and where it is now")}>
        <CompanyTabs companies={companies} value={companyId} onChange={setCompanyId} tone="pickup" all={t("सब कंपनी", "All")} />
      </ListHeader>
      <ScreenBody className="gap-3">
        <div className="flex gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t("बैग नंबर या पार्टी…", "Bag number or party…")} className="flex-1" />
          <ExportButton onClick={() => exportCollections({ collections: list, countLines, distributors, companies })} disabled={list.length === 0} />
        </div>
        <Chips
          label="Status"
          tone="pickup"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: `${t("सब", "All")} ${collections.length}` },
            { value: "uncounted", label: `${t("गिनती बाकी", "To count")} ${count("uncounted")}` },
            { value: "counted", label: `${t("गिना", "Counted")} ${count("counted")}` },
            { value: "packed", label: `${t("बैग में डाला", "In bags")} ${count("packed")}` },
          ]}
        />

        {list.length === 0 && <EmptyCard title={t("कोई बैग नहीं", "No bags")} detail={t("फ़िल्टर बदलकर देखें", "Try a different filter")} />}
        {byDay.map((group) => (
          <section key={group.date} className="flex flex-col gap-2">
            <p className="mx-0.5 mt-1 text-sm font-bold text-ink-faint">
              {fullDate(group.date, lang)} · {group.bags.length} {t("बैग", group.bags.length === 1 ? "bag" : "bags")}
            </p>
            <div className="grid gap-2 lg:grid-cols-2 [&>*]:min-w-0">
              {group.bags.map((bag) => {
                const company = companies.find((c) => c.id === bag.companyId);
                const party = distributors.find((d) => d.id === bag.distributorId);
                const pieces = countLines.filter((l) => l.collectionId === bag.id).reduce((s, l) => s + l.quantity, 0);
                return (
                  <Link key={bag.id} href={`/collections/${bag.id}`} className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 transition-colors hover:bg-elevated">
                    <CompanyAvatar company={company} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[17px] font-semibold">{bag.bagNumber}</span>
                      <span className="block truncate text-sm text-ink-dim">
                        {party?.name} · {pieces ? `${num(pieces)} ${t("पीस", "pcs")}` : bag.estimatedPieces ? `~${num(bag.estimatedPieces)} ${t("पीस", "pcs")}` : t("अंदाज़ा नहीं", "no estimate")}
                      </span>
                    </span>
                    <Pill tone={COLLECTION_TONE[bag.status]}>{t(COLLECTION_STATUS_HI[bag.status], COLLECTION_STATUS_LABELS[bag.status])}</Pill>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </ScreenBody>
    </Screen>
  );
}
