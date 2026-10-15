"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useFlash } from "@/lib/device";
import { daysSince, fullDate, inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { STALE_OPEN_DAYS, bagContents, bagValue, openBags, readyBags } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CountLine, SortedBag } from "@/types";
import { MrpCircle } from "@/components/ft/brand";
import { ChevronRightIcon, LayersIcon, SackIcon, SendIcon, WarehouseIcon } from "@/components/ft/icons";
import { Pill } from "@/components/ft/kit";
import { AgePill, BigButton, BigLink, CompanyTabs, ListHeader, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { BagNumber } from "@/components/count/bag-directions";
import { TieSheet } from "./tie-sheet";

/**
 * Bags in the godown, by company: the open bag of each MRP being filled as
 * pickups are counted (no piece limit), with a button to tie it when the
 * manager sees it is full, and the tied bags waiting for the factory.
 */
export function PilesBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useSession();
  const { t, lang } = useLang();
  const { companies, countLines, sortedBags, collections, distributors, products, closeOpenBags } = useStore();
  const [confirmClose, setConfirmClose] = useState(false);
  const [openBag, setOpenBag] = useState<string | null>(null);
  const [tying, setTying] = useState<string | null>(null);
  const [message, flash] = useFlash();
  const tie = (bag: SortedBag) => setTying(bag.id);
  const tyingBag = sortedBags.find((b) => b.id === tying);

  const open = useMemo(() => openBags(sortedBags), [sortedBags]);
  const ready = useMemo(() => readyBags(sortedBags), [sortedBags]);
  const withBags = companies.filter((c) => open.some((b) => b.companyId === c.id) || ready.some((b) => b.companyId === c.id));
  const openCount = (id: string) => open.filter((b) => b.companyId === id).length;

  const fallback = [...withBags].sort((a, b) => openCount(b.id) - openCount(a.id))[0]?.id ?? "";
  const requested = params.get("company");
  const [chosen, setChosen] = useState<string | null>(null);
  // A company picked earlier whose bags have all gone falls back too.
  const companyId = chosen && withBags.some((c) => c.id === chosen) ? chosen : requested && withBags.some((c) => c.id === requested) ? requested : fallback;
  const company = companies.find((c) => c.id === companyId);

  const filling = open.filter((b) => b.companyId === companyId);
  const loose = filling.reduce((s, b) => s + b.pieceCount, 0);
  const tiedHere = ready.filter((b) => b.companyId === companyId);
  const tiedByMrp = Array.from(new Set(tiedHere.map((b) => b.mrp)))
    .sort((a, b) => a - b)
    .map((mrp) => ({ mrp, bags: tiedHere.filter((b) => b.mrp === mrp).sort((a, b) => a.bagNumber.localeCompare(b.bagNumber)) }));
  const partyOf = (collectionId: string) => distributors.find((d) => d.id === collections.find((c) => c.id === collectionId)?.distributorId)?.name ?? "—";
  const nameOf = (productId: string) => products.find((p) => p.id === productId)?.name ?? "—";
  const sheetBag = sortedBags.find((b) => b.id === openBag);

  return (
    <Screen width="wide">
      <ListHeader tone="pile" icon={<LayersIcon size={26} />} title={t("गोदाम के बैग", "Bags in the godown")} subtitle={t("भर रहे बैग और बँधे बैग, MRP के हिसाब से", "Bags being filled and bags tied, by MRP")}>
        {withBags.length > 0 && (
          <CompanyTabs
            companies={withBags}
            value={companyId}
            onChange={setChosen}
            tone="pile"
            counts={Object.fromEntries(withBags.filter((c) => c.id !== companyId).map((c) => [c.id, String(openCount(c.id))]))}
          />
        )}
      </ListHeader>

      <ScreenBody className="gap-2.5">
        {withBags.length === 0 && (
          <div className="rounded-[20px] border border-line bg-surface px-4 py-10 text-center">
            <p className="font-display text-2xl font-extrabold">{t("गोदाम में कोई बैग नहीं", "No bags in the godown")}</p>
            <p className="mt-1 text-ink-dim">{t("पिकअप बैग गिनते ही माल यहाँ के नंबर वाले बैगों में जाएगा", "Counted goods go straight into numbered bags shown here")}</p>
          </div>
        )}

        {company && (
          <h2 className="mx-0.5 font-display text-[21px] font-extrabold">
            {t("भर रहे बैग", "Bags being filled")} <span className="font-sans text-sm font-medium text-ink-faint">· {filling.length}</span>
          </h2>
        )}
        {company && filling.length === 0 && (
          <p className="rounded-2xl bg-surface p-3.5 text-[15px] text-ink-dim">{t("कोई खुला बैग नहीं — अगली गिनती से नया बैग खुलेगा", "No open bag — the next count opens a new one")}</p>
        )}

        <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
          {filling.map((bag) => {
            const age = daysSince(bag.createdDate);
            return (
              <div key={bag.id} className={cn("flex flex-col rounded-[20px] bg-surface", age >= STALE_OPEN_DAYS ? "border-2 border-count" : "border border-line")}>
                <button type="button" onClick={() => setOpenBag(bag.id)} className="rounded-t-[20px] p-3.5 text-left transition-colors hover:bg-elevated">
                  <div className="flex items-center gap-3">
                    <MrpCircle mrp={bag.mrp} size={52} />
                    <span className="min-w-0 flex-1">
                      <BagNumber value={bag.bagNumber} className="block truncate text-[24px]" />
                      <span className="mt-1 block text-[15px] font-bold text-ink-dim">
                        {num(bag.pieceCount)} {t("पीस", "pcs")} · {inr(bagValue(bag))}
                      </span>
                    </span>
                    <AgePill days={age} warnAt={STALE_OPEN_DAYS} alarmAt={STALE_OPEN_DAYS * 2} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-sm text-ink-dim">
                    {bag.own?.pieces ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-godown-tint px-2 py-0.5 font-bold text-godown-soft">
                        <WarehouseIcon size={14} />
                        {t(`गोदाम ${num(bag.own.pieces)}`, `Godown ${num(bag.own.pieces)}`)}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{(bag.items ?? []).map((i) => `${nameOf(i.productId)} ${num(i.pieces)}`).join(" · ")}</span>
                    <span className="flex shrink-0 items-center gap-0.5 font-bold text-pile-soft">
                      {t("पूरी जानकारी", "Details")}
                      <ChevronRightIcon size={16} />
                    </span>
                  </div>
                </button>
                {can("tieSend") && (
                  <button
                    type="button"
                    onClick={() => tie(bag)}
                    className="m-3.5 mt-0 flex h-12 items-center justify-center gap-2 rounded-2xl bg-pile-tint text-base font-bold text-pile-soft transition-colors hover:brightness-125"
                  >
                    <SackIcon size={20} />
                    {t("बैग भर गया — मुँह बाँधें", "Bag full — tie it")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {tiedByMrp.length > 0 && (
          <section className="mt-2 flex flex-col gap-2">
            <h2 className="mx-0.5 font-display text-[21px] font-extrabold">
              {t("बँधे बैग, फैक्ट्री के लिए तैयार", "Tied bags, ready for the factory")}{" "}
              <span className="font-sans text-sm font-medium text-ink-faint">· {tiedHere.length}</span>
            </h2>
            <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
              {tiedByMrp.map(({ mrp, bags }) => (
                <div key={mrp} className="rounded-[20px] border border-line bg-surface p-3.5">
                  <div className="mb-2 flex items-center gap-2.5">
                    <MrpCircle mrp={mrp} size={36} />
                    <b className="flex-1 text-base">
                      {bags.length} {t("बैग", "bags")} · {num(bags.reduce((s, b) => s + b.pieceCount, 0))} {t("पीस", "pcs")}
                    </b>
                  </div>
                  <ol className="flex flex-col divide-y divide-line">
                    {bags.map((b, i) => (
                      <li key={b.id}>
                        <button type="button" onClick={() => setOpenBag(b.id)} className="flex w-full items-center gap-2.5 py-2 text-left">
                          <span className="w-6 shrink-0 text-right text-sm font-bold text-ink-faint">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <BagNumber value={b.bagNumber} className="block truncate text-[17px]" />
                            <span className="block truncate text-[13px] text-ink-dim">
                              {num(b.pieceCount)} {t("पीस", "pcs")}
                              {b.own?.pieces ? ` · ${t(`गोदाम का ${num(b.own.pieces)}`, `${num(b.own.pieces)} own godown`)}` : ""} · {(b.items ?? []).map((x) => nameOf(x.productId)).join(", ") || "—"}
                            </span>
                          </span>
                          <Pill tone={daysSince(b.tiedDate ?? b.createdDate) >= 14 ? "danger" : "factory"} className="px-2 py-0.5 text-xs">
                            {daysSince(b.tiedDate ?? b.createdDate) === 0 ? t("आज", "today") : t(`${daysSince(b.tiedDate ?? b.createdDate)} दिन`, `${daysSince(b.tiedDate ?? b.createdDate)}d`)}
                          </Pill>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {filling.length > 1 && loose > 0 && can("tieSend") && (
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            className="min-h-[52px] shrink-0 rounded-2xl border border-dashed border-pile-line px-3 py-2 text-[15px] font-bold leading-[1.3] text-pile-soft"
          >
            {t(`सारे ${filling.length} खुले बैग एक साथ बाँधें`, `Tie all ${filling.length} open bags at once`)}
            <br />
            <span className="font-medium text-pile-mute">{t("जैसे फैक्ट्री गाड़ी जाने से पहले", "e.g. before a factory run")}</span>
          </button>
        )}
      </ScreenBody>

      {tiedHere.length > 0 && can("tieSend") && (
        <ScreenFooter className="py-2.5">
          <BigLink tone="factory" href={`/send?company=${companyId}`} className="h-[60px]">
            <SendIcon />
            {t(`${tiedHere.length} बैग फैक्ट्री भेजो`, `Send ${tiedHere.length} bag${tiedHere.length > 1 ? "s" : ""} to the factory`)}
          </BigLink>
        </ScreenFooter>
      )}

      {sheetBag && <BagSheet bag={sheetBag} partyOf={partyOf} nameOf={nameOf} onClose={() => setOpenBag(null)} onTie={() => tie(sheetBag)} />}
      {tyingBag && (
        <TieSheet
          bag={tyingBag}
          nameOf={nameOf}
          onClose={() => setTying(null)}
          onTied={(moved) => {
            flash(
              moved
                ? t(`${tyingBag.bagNumber} बँधा। बचा माल नए बैग ${moved.bagNumber} में डालें`, `${tyingBag.bagNumber} tied. Put what is left in new bag ${moved.bagNumber}`)
                : t(`${tyingBag.bagNumber} बँध गया — फैक्ट्री के लिए तैयार`, `${tyingBag.bagNumber} tied — ready for the factory`)
            );
            // The new bag's number and contents, to write on the fresh bag.
            if (moved) setOpenBag(moved.id);
          }}
        />
      )}
      <Notice message={message} />

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t("सारे खुले बैग बाँधें?", "Tie all the open bags?")}
        footer={
          <BigButton
            tone="pile"
            onClick={() => {
              setConfirmClose(false);
              const closed = closeOpenBags(companyId);
              if (closed.length) router.push(`/piles/tied?ids=${closed.map((b) => b.id).join(",")}`);
            }}
          >
            <SackIcon />
            {t(`हाँ, ${filling.length} बैग बाँधो`, `Yes, tie ${filling.length} bag${filling.length > 1 ? "s" : ""}`)}
          </BigButton>
        }
      >
        <p className="text-base leading-[1.4] text-ink-soft">
          {lang === "hi"
            ? `${company?.name} के सारे ${filling.length} खुले बैग (${num(loose)} पीस) अभी बँध जाएँगे और फैक्ट्री भेजे जा सकेंगे। अगली गिनती से हर MRP का नया बैग खुलेगा।`
            : `All ${filling.length} of ${company?.name}'s open bags (${num(loose)} pieces) are tied now and can go to the factory. The next count opens a new bag for each MRP.`}
        </p>
      </Dialog>
    </Screen>
  );
}

/** One bag in full: its items, and whose pickups they came from. */
function BagSheet({ bag, partyOf, nameOf, onClose, onTie }: { bag: SortedBag; partyOf: (id: string) => string; nameOf: (id: string) => string; onClose: () => void; onTie: () => void }) {
  const { t, lang } = useLang();
  const { can } = useSession();
  const { companies, collections, countLines, sortedBags, untieBag } = useStore();
  // Untying is refused while another bag of the same MRP is open.
  const otherOpen = sortedBags.find((b) => b.id !== bag.id && b.status === "open" && b.companyId === bag.companyId && b.mrp === bag.mrp);
  const company = companies.find((c) => c.id === bag.companyId);
  const parts = bagContents(bag, countLines);
  const partyPieces = parts.reduce((s, p) => s + p.pieces, 0);

  return (
    <Dialog
      open
      onClose={onClose}
      title={bag.bagNumber}
      description={`${company?.name} · MRP ₹${bag.mrp} · ${num(bag.pieceCount)} ${t("पीस", "pcs")} · ${
        bag.status === "open" ? t("भर रहा है", "being filled") : t("बँधा, भेजने को तैयार", "tied, ready to send")
      } · ${t("खुला", "opened")} ${fullDate(bag.createdDate, lang)}${bag.tiedDate ? ` · ${t("बँधा", "tied")} ${fullDate(bag.tiedDate, lang)}` : ""}`}
      footer={
        can("tieSend") && bag.status === "open" ? (
          <BigButton
            tone="pile"
            onClick={() => {
              onTie();
              onClose();
            }}
          >
            <SackIcon />
            {t("बैग भर गया — मुँह बाँधें", "Bag full — tie it")}
          </BigButton>
        ) : can("tieSend") && bag.status === "ready" ? (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={!!otherOpen}
              onClick={() => {
                if (untieBag(bag.id)) onClose();
              }}
              className="flex h-12 items-center justify-center rounded-2xl bg-elevated text-base font-bold text-ink-dim hover:bg-raised disabled:opacity-40"
            >
              {t("गलती से बँधा? फिर से खोलें", "Tied by mistake? Open it again")}
            </button>
            {otherOpen && (
              <p className="text-center text-sm text-ink-faint">
                {t(`₹${bag.mrp} का बैग ${otherOpen.bagNumber} अभी खुला है, इसलिए यह नहीं खुल सकता`, `₹${bag.mrp} bag ${otherOpen.bagNumber} is open now, so this one cannot be reopened`)}
              </p>
            )}
          </div>
        ) : undefined
      }
    >
      <p className="mb-2 text-[15px] font-bold">{t("बैग में क्या है", "What is in the bag")}</p>
      <ul className="mb-4 flex flex-col divide-y divide-line rounded-2xl bg-elevated px-3 py-1">
        {(bag.items ?? []).map((i) => (
          <li key={i.productId} className="flex items-center justify-between gap-3 py-2 text-base">
            <span className="min-w-0 truncate">{nameOf(i.productId)}</span>
            <b>{num(i.pieces)}</b>
          </li>
        ))}
      </ul>

      <OwnGodownBlock bag={bag} countLines={countLines} nameOf={nameOf} />

      {parts.length > 0 && (
        <p className="mb-2 text-[15px] font-bold">
          {t("पार्टियों का माल", "Parties' goods")} <span className="font-medium text-ink-faint">· {num(partyPieces)} {t("पीस", "pcs")} · {parts.length} {t("पिकअप बैग", "pickup bags")}</span>
        </p>
      )}
      <div className="flex flex-col gap-2">
        {parts.map((part) => {
          const pickup = collections.find((c) => c.id === part.collectionId);
          return (
            <Link key={part.collectionId} href={`/collections/${part.collectionId}`} className="flex items-center gap-3 rounded-2xl bg-elevated p-3 hover:bg-raised">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{partyOf(part.collectionId)}</span>
                <span className="block truncate font-mono text-[13px] text-ink-dim">{pickup?.bagNumber}</span>
              </span>
              <b>
                {num(part.pieces)} {t("पीस", "pcs")}
              </b>
            </Link>
          );
        })}
      </div>
    </Dialog>
  );
}

/**
 * Pieces in a bag that were damaged in our own godown, shown apart from the
 * parties' goods, item by item, each linked to its godown entry.
 */
export function OwnGodownBlock({ bag, countLines, nameOf }: { bag: SortedBag; countLines: CountLine[]; nameOf: (id: string) => string }) {
  const { t } = useLang();
  if (!bag.own?.pieces) return null;
  const lines = countLines.filter((l) => l.bagId === bag.id && l.recordId);
  const items = Array.from(lines.reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>())).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mb-4 rounded-2xl border border-godown-line bg-godown-panel p-3">
      <div className="flex items-center gap-2.5">
        <WarehouseIcon size={22} className="shrink-0 text-godown" />
        <span className="min-w-0 flex-1 font-bold leading-tight">
          {t("अपने गोदाम का नुकसान", "Damaged in our own godown")}
          <span className="block text-[13px] font-medium text-godown-mute">{t("किसी पार्टी का नहीं", "Not from any party")}</span>
        </span>
        <b className="shrink-0 font-display text-xl text-godown">
          {num(bag.own.pieces)} {t("पीस", "pcs")}
        </b>
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-godown-line">
        {items.map(([productId, pieces]) => (
          <li key={productId}>
            <Link href="/godown" className="flex items-center justify-between gap-3 py-1.5 text-[15px]">
              <span className="min-w-0 truncate">{nameOf(productId)}</span>
              <b>{num(pieces)}</b>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
