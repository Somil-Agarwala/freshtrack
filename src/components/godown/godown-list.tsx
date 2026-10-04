"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OPEN_STATUSES, REASON_HI, REASON_LABELS, STATUS_HI, STATUS_LABELS } from "@/lib/constants";
import { useFlash } from "@/lib/device";
import { exportRecords } from "@/lib/export";
import { daysSince, fullDate, inr, lakhShort, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { monthStart } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DamageRecord, ResolutionStatus } from "@/types";
import { CompanyAvatar, ProductPicture } from "@/components/ft/brand";
import { PlusIcon, TrashIcon, WarehouseIcon } from "@/components/ft/icons";
import { Chips, ChoiceGrid, EmptyCard, ExportButton, Pill, SearchBox, StatTile } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";

type Filter = "all" | "open" | "closed";

/** Own godown damage and expiry: everything lost outside the claim pipeline. */
export function GodownList() {
  const { t, sub, lang } = useLang();
  const { records, products, companies, distributors, updateRecord, deleteRecords } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [message, flash] = useFlash();

  const month = monthStart();
  const thisMonth = records.filter((r) => r.date >= month);
  const monthLoss = thisMonth.reduce((s, r) => s + r.costValue, 0);
  const openCount = records.filter((r) => OPEN_STATUSES.includes(r.status)).length;

  const byReason = useMemo(() => {
    const m = new Map<string, number>();
    records.filter((r) => daysSince(r.date) <= 90).forEach((r) => m.set(r.reason, (m.get(r.reason) ?? 0) + r.costValue));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);
  const maxReason = byReason[0]?.[1] || 1;

  const q = query.trim().toLowerCase();
  const list = records
    .filter((r) => (filter === "all" ? true : filter === "open" ? OPEN_STATUSES.includes(r.status) : !OPEN_STATUSES.includes(r.status)))
    .filter((r) => {
      if (!q) return true;
      const p = products.find((x) => x.id === r.productId);
      return [p?.name, p?.sku, r.batchNumber, r.responsibleParty].some((v) => v?.toLowerCase().includes(q));
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const record = records.find((r) => r.id === open);
  const reasonLabel = (r: DamageRecord) => t(REASON_HI[r.reason], REASON_LABELS[r.reason]);

  return (
    <Screen width="wide">
      <ListHeader tone="godown" icon={<WarehouseIcon size={26} />} title={t("गोदाम का नुकसान", "Godown damage")} subtitle={t("अपने माल की टूट-फूट और एक्सपायरी", "Your own stock: breakage and expiry")} />

      <ScreenBody className="gap-3">
        <Link href="/godown/new" className="flex items-center gap-4 rounded-[22px] bg-godown p-4 text-godown-ink transition hover:brightness-110">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-godown-ink text-godown">
            <PlusIcon size={26} />
          </span>
          <span className="flex-1">
            <span className="block font-display text-[22px] font-extrabold leading-[1.1]">{t("नुकसान दर्ज करें", "Log damaged stock")}</span>
            <span className="block text-[15px] font-semibold opacity-80">{sub("गोदाम में माल ख़राब हुआ?", "Something damaged in the godown?")}</span>
          </span>
        </Link>

        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          <StatTile label={t("इस महीने नुकसान", "Lost this month")} value={lakhShort(monthLoss, 1)} foot={`${thisMonth.length} ${t("एंट्री", "entries")}`} tone="godown" />
          <StatTile label={t("जाँच बाकी", "To review")} value={String(openCount)} foot={t("फ़ैसला बाकी", "need a decision")} tone={openCount ? "count" : undefined} />
          <StatTile label={t("कुल एंट्री", "All entries")} value={num(records.length)} foot={lakhShort(records.reduce((s, r) => s + r.costValue, 0), 1)} />
        </div>

        {byReason.length > 0 && (
          <section className="rounded-[20px] border border-line bg-surface p-4">
            <p className="mb-2.5 text-[15px] font-bold">
              {t("किस वजह से नुकसान", "Loss by reason")} <span className="font-medium text-ink-faint">· 90 {t("दिन", "days")}</span>
            </p>
            <div className="flex flex-col gap-2.5 text-[15px]">
              {byReason.map(([reason, value]) => (
                <div key={reason}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{t(REASON_HI[reason as DamageRecord["reason"]], REASON_LABELS[reason as DamageRecord["reason"]])}</span>
                    <b>{inr(value)}</b>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-raised">
                    <div className="h-2.5 rounded-full bg-godown" style={{ width: `${(value / maxReason) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t("सामान, बैच या नाम खोजें…", "Search item, batch or name…")} className="flex-1" />
          <ExportButton onClick={() => exportRecords({ records: list, products, distributors, companies })} disabled={list.length === 0} />
        </div>
        <Chips
          label="Filter"
          tone="godown"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `${t("सब", "All")} ${records.length}` },
            { value: "open", label: `${t("जाँच बाकी", "To review")} ${openCount}` },
            { value: "closed", label: t("निपटे", "Closed") },
          ]}
        />

        {list.length === 0 && <EmptyCard title={t("कोई एंट्री नहीं", "No entries")} detail={t("ऊपर से नया नुकसान दर्ज करें", "Log damaged stock from the button above")} />}
        <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
          {list.map((r) => {
            const product = products.find((p) => p.id === r.productId);
            const company = companies.find((c) => c.id === r.companyId);
            const party = distributors.find((d) => d.id === r.distributorId);
            const isOpen = OPEN_STATUSES.includes(r.status);
            return (
              <button key={r.id} type="button" onClick={() => setOpen(r.id)} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5 text-left transition-colors hover:bg-elevated">
                <span className="flex w-full items-center gap-3">
                  {product ? <ProductPicture product={product} className="h-12 w-12 shrink-0" size={24} /> : <span className="h-12 w-12 rounded-xl bg-elevated" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-bold leading-tight">{product?.name ?? "—"}</span>
                    <span className="block truncate text-sm text-ink-dim">
                      {num(r.quantity)} {r.unit} · {reasonLabel(r)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <b className="block font-display text-xl font-extrabold leading-none">{inr(r.costValue)}</b>
                    <Pill tone={isOpen ? "count" : "neutral"} className="mt-1 px-2 py-0.5 text-xs">
                      {t(STATUS_HI[r.status], STATUS_LABELS[r.status])}
                    </Pill>
                  </span>
                </span>
                <span className="flex w-full items-center gap-2 text-[13px] text-ink-faint">
                  <CompanyAvatar company={company} size={22} />
                  <span className="min-w-0 flex-1 truncate">
                    {fullDate(r.date, lang)} · {r.source === "own_inventory" ? t("अपना गोदाम", "Own godown") : party?.name ?? t("पार्टी", "Party")}
                    {r.responsibleParty && r.responsibleParty !== party?.name ? ` · ${r.responsibleParty}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </ScreenBody>

      {record && (
        <RecordSheet
          record={record}
          onClose={() => setOpen(null)}
          onStatus={(status) => {
            updateRecord(record.id, { status });
            flash(t(`स्थिति बदली: ${STATUS_HI[status]}`, `Status changed: ${STATUS_LABELS[status]}`));
          }}
          onDelete={() => {
            deleteRecords([record.id]);
            setOpen(null);
            flash(t("एंट्री हटा दी", "Entry deleted"));
          }}
        />
      )}
      <Notice message={message} />
    </Screen>
  );
}

function RecordSheet({ record, onClose, onStatus, onDelete }: { record: DamageRecord; onClose: () => void; onStatus: (s: ResolutionStatus) => void; onDelete: () => void }) {
  const { t, lang } = useLang();
  const { products, companies, distributors } = useStore();
  const [confirm, setConfirm] = useState(false);
  const product = products.find((p) => p.id === record.productId);
  const company = companies.find((c) => c.id === record.companyId);
  const party = distributors.find((d) => d.id === record.distributorId);
  const rows: [string, string][] = [
    [t("कंपनी", "Company"), company?.name ?? "—"],
    [t("कहाँ", "Where"), record.source === "own_inventory" ? t("अपना गोदाम", "Own godown") : party?.name ?? "—"],
    [t("कितना", "Quantity"), `${num(record.quantity)} ${record.unit}`],
    [t("वजह", "Reason"), t(REASON_HI[record.reason], REASON_LABELS[record.reason])],
    [t("बैच", "Batch"), record.batchNumber || "—"],
    [t("तारीख", "Date"), fullDate(record.date, lang)],
    [t("ज़िम्मेदार", "Responsible"), record.responsibleParty || "—"],
    [t("फोटो", "Photo"), record.hasPhoto ? t("है", "Yes") : t("नहीं", "No")],
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      title={product?.name ?? t("एंट्री", "Entry")}
      description={`${t("नुकसान", "Loss")} ${inr(record.costValue)}`}
      footer={
        confirm ? (
          <BigButton tone="neutral" onClick={onDelete} className="bg-danger-tint text-danger-soft hover:bg-danger-tint">
            <TrashIcon />
            {t("हाँ, हटा दो", "Yes, delete it")}
          </BigButton>
        ) : (
          <BigButton tone="neutral" onClick={onClose}>
            {t("ठीक है", "Done")}
          </BigButton>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl bg-elevated p-3.5 text-[15px]">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[13px] text-ink-faint">{k}</dt>
            <dd className="truncate font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      {record.notes && <p className="mt-3 rounded-2xl bg-elevated p-3.5 text-[15px] text-ink-soft">{record.notes}</p>}

      <p className="mb-2 mt-4 text-[15px] font-bold">{t("अब क्या स्थिति है?", "Where does it stand?")}</p>
      <ChoiceGrid
        tone="godown"
        value={record.status}
        onChange={onStatus}
        options={(Object.keys(STATUS_HI) as ResolutionStatus[]).map((s) => ({ value: s, label: t(STATUS_HI[s], STATUS_LABELS[s]) }))}
      />

      {!confirm && (
        <button type="button" onClick={() => setConfirm(true)} className={cn("mt-4 flex items-center gap-2 text-[15px] font-bold text-danger-soft")}>
          <TrashIcon size={18} />
          {t("यह एंट्री हटाएँ", "Delete this entry")}
        </button>
      )}
    </Dialog>
  );
}
