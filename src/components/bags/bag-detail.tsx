"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { COLLECTION_STATUS_HI, COLLECTION_STATUS_LABELS } from "@/lib/constants";
import { daysSince, fullDate, inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { bagContents } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CompanyAvatar, MrpCircle } from "@/components/ft/brand";
import { ArrowRightIcon, CheckIcon, TrashIcon } from "@/components/ft/icons";
import { EmptyCard, Pill } from "@/components/ft/kit";
import { BigButton, BigLink, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";

/** One pickup bag from arrival to the factory, with what was counted in it. */
export function BagDetail({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const { t, lang } = useLang();
  const { collections, companies, distributors, countLines, products, sortedBags, dispatches, deleteCollections } = useStore();
  const [confirm, setConfirm] = useState(false);
  const bag = collections.find((c) => c.id === collectionId);

  if (!bag) {
    return (
      <Screen>
        <TaskHeader back="/collections" tone="pickup" kicker={t("सारे बैग", "All bags")} />
        <ScreenBody>
          <EmptyCard title={t("यह बैग नहीं मिला", "Bag not found")} detail={t("शायद हटा दिया गया", "It may have been deleted")} />
        </ScreenBody>
      </Screen>
    );
  }

  const company = companies.find((c) => c.id === bag.companyId);
  const party = distributors.find((d) => d.id === bag.distributorId);
  const lines = countLines.filter((l) => l.collectionId === bag.id);
  // Lines split when a bag fills part-way, so merge them back per item.
  const items = Array.from(
    lines.reduce((m, l) => m.set(l.productId, { mrp: l.mrp, qty: (m.get(l.productId)?.qty ?? 0) + l.quantity }), new Map<string, { mrp: number; qty: number }>())
  ).sort((a, b) => b[1].qty - a[1].qty);
  const pieces = lines.reduce((s, l) => s + l.quantity, 0);
  const value = lines.reduce((s, l) => s + l.quantity * l.mrp, 0);
  const loose = lines.filter((l) => !l.packed).reduce((s, l) => s + l.quantity, 0);
  const anyPacked = lines.some((l) => l.packed);

  const tied = sortedBags
    .map((sb) => ({ sb, pieces: bagContents(sb, countLines).find((c) => c.collectionId === bag.id)?.pieces ?? 0 }))
    .filter((x) => x.pieces > 0);
  const runs = Array.from(new Set(tied.map((x) => x.sb.dispatchId).filter(Boolean))).map((id) => dispatches.find((d) => d.id === id)!).filter(Boolean);

  const steps: { done: boolean; title: string; detail: ReactNode }[] = [
    { done: true, title: t("पार्टी से आया", "Picked up"), detail: `${fullDate(bag.collectedDate, lang)} · ${party?.name ?? ""}` },
    {
      done: bag.status !== "uncounted",
      title: t("गिना गया", "Counted"),
      detail: bag.countedDate ? `${fullDate(bag.countedDate, lang)} · ${num(pieces)} ${t("पीस", "pcs")}` : t(`${daysSince(bag.collectedDate)} दिन से इंतज़ार`, `waiting ${daysSince(bag.collectedDate)} days`),
    },
    {
      done: tied.length > 0,
      title: t("बैग में बँधा", "Tied into bags"),
      detail: tied.length ? `${tied.length} ${t("बैग", "bags")}${loose ? ` · ${num(loose)} ${t("पीस अभी ढेर में", "pcs still in piles")}` : ""}` : loose ? `${num(loose)} ${t("पीस ढेर में", "pcs in piles")}` : "—",
    },
    { done: runs.length > 0, title: t("फैक्ट्री भेजा", "Sent to factory"), detail: runs.length ? runs.map((r) => r.dispatchNumber).join(", ") : "—" },
  ];

  return (
    <Screen>
      <TaskHeader back="/collections" tone="pickup" kicker={`${company?.name} · ${t(COLLECTION_STATUS_HI[bag.status], COLLECTION_STATUS_LABELS[bag.status])}`} aside={<CompanyAvatar company={company} size={44} />}>
        <p className="truncate font-mono text-[19px] font-semibold">{bag.bagNumber}</p>
      </TaskHeader>

      <ScreenBody className="gap-3">
        <ol className="rounded-[20px] border border-line bg-surface p-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && <span className={cn("absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5", s.done && steps[i + 1].done ? "bg-money" : "bg-raised")} />}
              <span className={cn("z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", s.done ? "bg-money text-money-ink" : "border-2 border-line-strong bg-canvas")}>
                {s.done && <CheckIcon size={15} />}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-base font-bold", !s.done && "text-ink-dim")}>{s.title}</span>
                <span className="block truncate text-sm text-ink-dim">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-2 gap-2 text-[15px]">
          <Info label={t("पार्टी", "Party")} value={party?.name ?? "—"} />
          <Info label={t("इलाका", "Area")} value={party?.region ?? "—"} />
          <Info label={t("अंदाज़न पीस", "Rough pieces")} value={bag.estimatedPieces ? `~${num(bag.estimatedPieces)}` : "—"} />
          <Info label={t("गिने पीस", "Counted")} value={pieces ? `${num(pieces)} · ${inr(value)}` : "—"} />
        </div>
        {bag.notes && <p className="rounded-2xl bg-surface p-3.5 text-[15px] text-ink-soft">{bag.notes}</p>}
        {bag.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL
          <img src={bag.photoUrl} alt={t("पिकअप की फोटो", "Pickup photo")} className="max-h-64 w-full rounded-2xl object-cover" />
        )}

        {items.length > 0 && (
          <section className="rounded-[20px] border border-line bg-surface px-3.5 py-3">
            <p className="mb-2 text-[15px] font-bold text-ink-dim">{t("क्या-क्या निकला", "What was inside")}</p>
            <div className="flex flex-col gap-1.5">
              {items.map(([productId, row]) => (
                <div key={productId} className="flex items-center gap-2.5 text-base">
                  <MrpCircle mrp={row.mrp} size={34} />
                  <span className="min-w-0 flex-1 truncate">{products.find((p) => p.id === productId)?.name ?? "—"}</span>
                  <b>{num(row.qty)}</b>
                </div>
              ))}
            </div>
          </section>
        )}

        {tied.length > 0 && (
          <section className="rounded-[20px] border border-line bg-surface px-3.5 py-3">
            <p className="mb-2 text-[15px] font-bold text-ink-dim">{t("किन बैगों में गया", "Tied into")}</p>
            <div className="flex flex-col divide-y divide-line">
              {tied.map(({ sb, pieces: p }) => (
                <div key={sb.id} className="flex items-center gap-2.5 py-2">
                  <MrpCircle mrp={sb.mrp} size={32} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold">{sb.bagNumber}</span>
                  <span className="text-sm text-ink-dim">
                    {num(p)} {t("पीस", "pcs")}
                  </span>
                  <Pill tone={sb.status === "ready" ? "factory" : "money"} className="px-2 py-0.5 text-xs">
                    {sb.status === "ready" ? t("गोदाम में", "In godown") : t("भेजा", "Sent")}
                  </Pill>
                </div>
              ))}
            </div>
          </section>
        )}

        {!anyPacked && (
          <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-2 self-start py-2 text-[15px] font-bold text-danger-soft">
            <TrashIcon size={18} />
            {t("यह बैग हटाएँ", "Delete this bag")}
          </button>
        )}
      </ScreenBody>

      {(confirm || bag.status === "uncounted" || (bag.status === "counted" && !anyPacked)) && (
        <ScreenFooter>
          {confirm ? (
            <>
              <BigButton
                tone="neutral"
                className="bg-danger-tint text-danger-soft hover:bg-danger-tint"
                onClick={() => {
                  deleteCollections([bag.id]);
                  router.replace("/collections");
                }}
              >
                <TrashIcon />
                {t(`हाँ, ${bag.bagNumber} हटाओ`, `Yes, delete ${bag.bagNumber}`)}
              </BigButton>
              <button type="button" onClick={() => setConfirm(false)} className="h-11 text-base font-bold text-ink-dim">
                {t("रहने दो", "Keep it")}
              </button>
            </>
          ) : bag.status === "uncounted" ? (
            <BigLink tone="count" href={`/count/${bag.id}`}>
              {t("गिनती शुरू करें · Start counting", "Start counting · गिनती शुरू करें")}
              <ArrowRightIcon />
            </BigLink>
          ) : (
            <BigLink tone="neutral" href={`/count/${bag.id}`} className="h-[60px]">
              {t("गिनती ठीक करें", "Correct the count")}
            </BigLink>
          )}
        </ScreenFooter>
      )}
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface p-3">
      <p className="text-[13px] text-ink-faint">{label}</p>
      <p className="truncate font-bold">{value}</p>
    </div>
  );
}
