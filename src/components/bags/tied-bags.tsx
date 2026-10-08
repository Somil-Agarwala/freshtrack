"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { exportSortedBags } from "@/lib/export";
import { daysSince, fullDate, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { bagContents } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import type { SortedBag } from "@/types";
import { CompanyAvatar, MrpCircle } from "@/components/ft/brand";
import { LayersIcon, PrinterIcon, SendIcon } from "@/components/ft/icons";
import { Chips, EmptyCard, ExportButton, Pill, SearchBox } from "@/components/ft/kit";
import { PrintLabel, PrintSheet } from "@/components/ft/print-sheet";
import { BigButton, BigLink, CompanyTabs, ListHeader, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

type Filter = "open" | "ready" | "dispatched" | "all";

/** Every tied 700-piece bag: still in the godown, or gone to the factory. */
export function TiedBags({ initialSearch = "" }: { initialSearch?: string }) {
  const { t } = useLang();
  const { sortedBags, companies, collections, distributors, countLines, products, dispatches } = useStore();
  const [filter, setFilter] = useState<Filter>(initialSearch ? "all" : "ready");
  const [companyId, setCompanyId] = useState("all");
  const [query, setQuery] = useState(initialSearch);
  const [open, setOpen] = useState<string | null>(null);

  const partyNames = (bag: SortedBag) =>
    Array.from(
      new Set(
        bagContents(bag, countLines)
          .map((c) => distributors.find((d) => d.id === collections.find((x) => x.id === c.collectionId)?.distributorId)?.name)
          .filter((n): n is string => !!n)
      )
    );

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      sortedBags
        .filter((b) => (filter === "all" || b.status === filter) && (companyId === "all" || b.companyId === companyId))
        .filter((b) => !q || b.bagNumber.toLowerCase().includes(q))
        .sort((a, b) => b.createdDate.localeCompare(a.createdDate) || b.bagNumber.localeCompare(a.bagNumber)),
    [sortedBags, filter, companyId, q]
  );
  const readyCount = sortedBags.filter((b) => b.status === "ready").length;
  const openCount = sortedBags.filter((b) => b.status === "open").length;
  const bag = sortedBags.find((b) => b.id === open);

  return (
    <Screen width="wide">
      <ListHeader tone="pile" icon={<LayersIcon size={26} />} title={t("नंबर वाले बैग", "Numbered bags")} subtitle={t("700 पीस के बैग: भर रहे, बँधे या फैक्ट्री गए", "700-piece bags: filling, tied or sent")}>
        <CompanyTabs companies={companies.filter((c) => sortedBags.some((b) => b.companyId === c.id))} value={companyId} onChange={setCompanyId} tone="pile" all={t("सब कंपनी", "All")} />
      </ListHeader>
      <ScreenBody className="gap-3">
        <div className="flex gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t("बैग नंबर…", "Bag number…")} className="flex-1" />
          <ExportButton onClick={() => exportSortedBags({ bags: list, collections, countLines, distributors, products, companies })} disabled={list.length === 0} />
        </div>
        <Chips
          label="Status"
          tone="pile"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: `${t("भर रहे", "Filling")} ${openCount}` },
            { value: "ready", label: `${t("बँधे, तैयार", "Tied, ready")} ${readyCount}` },
            { value: "dispatched", label: t("फैक्ट्री भेजे", "Sent") },
            { value: "all", label: `${t("सब", "All")} ${sortedBags.length}` },
          ]}
        />
        {list.length === 0 && <EmptyCard title={t("कोई बैग नहीं", "No bags")} detail={t("पिकअप बैग गिनने पर यहाँ नंबर वाले बैग बनेंगे", "Numbered bags appear here as pickups are counted")} />}
        <div className="grid gap-2 lg:grid-cols-2 [&>*]:min-w-0">
          {list.map((b) => {
            const names = partyNames(b);
            const run = dispatches.find((d) => d.id === b.dispatchId);
            return (
              <button key={b.id} type="button" onClick={() => setOpen(b.id)} className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 text-left transition-colors hover:bg-elevated">
                <MrpCircle mrp={b.mrp} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[17px] font-semibold">{b.bagNumber}</span>
                  <span className="block truncate text-sm text-ink-dim">
                    {num(b.pieceCount)} {t("पीस", "pcs")}
                    {!b.isFull && ` (${t("आधा", "part")})`} · {names.length ? `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ""}` : "—"}
                  </span>
                </span>
                {b.status === "open" ? (
                  <Pill tone="pile">
                    {num(b.pieceCount)}/700
                  </Pill>
                ) : b.status === "ready" ? (
                  <Pill tone={daysSince(b.createdDate) >= 14 ? "danger" : "factory"}>{t(`${daysSince(b.createdDate)} दिन से`, `${daysSince(b.createdDate)} days`)}</Pill>
                ) : (
                  <Pill tone="money" className="max-w-[40%] truncate">
                    {run?.dispatchNumber.replace(/-\d{4}-/, "-") ?? t("भेजा", "Sent")}
                  </Pill>
                )}
              </button>
            );
          })}
        </div>
      </ScreenBody>

      {filter !== "dispatched" && readyCount > 0 && (
        <ScreenFooter className="py-2.5">
          <BigLink tone="factory" href="/send" className="h-[60px]">
            <SendIcon />
            {t(`${readyCount} बैग फैक्ट्री भेजो`, `Send ${readyCount} bags to the factory`)}
          </BigLink>
        </ScreenFooter>
      )}

      {bag && <BagSheet bag={bag} partyNames={partyNames(bag)} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

function BagSheet({ bag, partyNames, onClose }: { bag: SortedBag; partyNames: string[]; onClose: () => void }) {
  const { t, lang } = useLang();
  const { companies, collections, distributors, countLines, dispatches, products } = useStore();
  const company = companies.find((c) => c.id === bag.companyId);
  const run = dispatches.find((d) => d.id === bag.dispatchId);
  const parts = bagContents(bag, countLines);

  return (
    <Dialog
      open
      onClose={onClose}
      title={bag.bagNumber}
      description={`${company?.name} · MRP ₹${bag.mrp} · ${num(bag.pieceCount)} ${t("पीस", "pcs")} · ${t("खुला", "opened")} ${fullDate(bag.createdDate, lang)}`}
      footer={
        <BigButton tone="pile" onClick={() => window.print()}>
          <PrinterIcon />
          {t("लेबल छापें", "Print label")}
        </BigButton>
      }
    >
      <div className="flex items-center gap-3 rounded-2xl bg-elevated p-3">
        <CompanyAvatar company={company} size={40} />
        <span className="flex-1 text-[15px]">
          {run ? (
            <>
              {t("फैक्ट्री भेजा", "Sent to the factory")}:{" "}
              <Link href={`/dispatches/${run.id}`} className="font-mono font-bold text-money">
                {run.dispatchNumber}
              </Link>
            </>
          ) : bag.status === "open" ? (
            t(`अभी भर रहा है — ${num(700 - bag.pieceCount)} पीस और आएँगे`, `Still being filled — ${num(700 - bag.pieceCount)} more pieces to go`)
          ) : (
            t(`${daysSince(bag.createdDate)} दिन से गोदाम में, भेजने को तैयार`, `In the godown for ${daysSince(bag.createdDate)} days, ready to send`)
          )}
        </span>
      </div>

      {(bag.items?.length ?? 0) > 0 && (
        <>
          <p className="mb-2 mt-4 text-[15px] font-bold">{t("बैग में क्या है", "What is in the bag")}</p>
          <ul className="flex flex-col divide-y divide-line rounded-2xl bg-elevated px-3 py-1">
            {bag.items!.map((i) => (
              <li key={i.productId} className="flex items-center justify-between gap-3 py-2 text-base">
                <span className="min-w-0 truncate">{products.find((p) => p.id === i.productId)?.name ?? "—"}</span>
                <b>{num(i.pieces)}</b>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mb-2 mt-4 text-[15px] font-bold">
        {t("किसका माल अंदर है", "Whose goods are inside")} <span className="font-medium text-ink-faint">· {partyNames.length}</span>
      </p>
      <div className="flex flex-col gap-2">
        {parts.map((part) => {
          const pickup = collections.find((c) => c.id === part.collectionId);
          return (
            <Link key={part.collectionId} href={`/collections/${part.collectionId}`} className="flex items-center gap-3 rounded-2xl bg-elevated p-3 hover:bg-raised">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{distributors.find((d) => d.id === pickup?.distributorId)?.name ?? "—"}</span>
                <span className="block truncate font-mono text-[13px] text-ink-dim">{pickup?.bagNumber}</span>
              </span>
              <b>
                {num(part.pieces)} {t("पीस", "pcs")}
              </b>
            </Link>
          );
        })}
      </div>

      <PrintSheet>
        <PrintLabel number={bag.bagNumber} lines={[`${company?.name} · MRP ₹${bag.mrp}`, `${num(bag.pieceCount)} pcs · ${partyNames.join(", ")}`]} />
      </PrintSheet>
    </Dialog>
  );
}
