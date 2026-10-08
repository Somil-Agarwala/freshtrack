"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { daysSince, fullDate, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { BAG_CAPACITY, NEAR_FULL, bagContents, openBags, readyBags } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SortedBag } from "@/types";
import { MrpCircle } from "@/components/ft/brand";
import { ChevronRightIcon, LayersIcon, SackIcon, SendIcon } from "@/components/ft/icons";
import { Pill } from "@/components/ft/kit";
import { BigButton, BigLink, CompanyTabs, ListHeader, PileBar, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { BagNumber } from "@/components/count/sort-guide";

/**
 * Bags in the godown, by company: the open bag of each MRP being filled as
 * pickups are counted, and the full bags tied and waiting for the factory.
 */
export function PilesBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useSession();
  const { t, lang } = useLang();
  const { companies, countLines, sortedBags, collections, distributors, products, closeOpenBags } = useStore();
  const [confirmClose, setConfirmClose] = useState(false);
  const [openBag, setOpenBag] = useState<string | null>(null);

  const open = useMemo(() => openBags(sortedBags), [sortedBags]);
  const ready = useMemo(() => readyBags(sortedBags), [sortedBags]);
  const withBags = companies.filter((c) => open.some((b) => b.companyId === c.id) || ready.some((b) => b.companyId === c.id));
  const openCount = (id: string) => open.filter((b) => b.companyId === id).length;

  const fallback = [...withBags].sort((a, b) => openCount(b.id) - openCount(a.id))[0]?.id ?? "";
  const requested = params.get("company");
  const [chosen, setChosen] = useState<string | null>(null);
  const companyId = chosen ?? (requested && withBags.some((c) => c.id === requested) ? requested : fallback);
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
            const need = BAG_CAPACITY - bag.pieceCount;
            const near = need <= NEAR_FULL;
            return (
              <button
                key={bag.id}
                type="button"
                onClick={() => setOpenBag(bag.id)}
                className={cn("rounded-[20px] p-3.5 text-left transition-colors", near ? "border-2 border-count bg-surface" : "border border-line bg-surface hover:bg-elevated")}
              >
                <div className="flex items-center gap-3">
                  <MrpCircle mrp={bag.mrp} size={52} />
                  <span className="min-w-0 flex-1">
                    <BagNumber value={bag.bagNumber} className="block truncate text-[24px]" />
                    <span className={cn("mt-1 block text-[15px] font-bold", near ? "text-count-soft" : "text-ink-dim")}>
                      {num(bag.pieceCount)} / {BAG_CAPACITY} · {near ? t(`सिर्फ़ ${need} और`, `only ${need} more`) : t(`${num(need)} और आएँगे`, `${num(need)} more to go`)}
                    </span>
                  </span>
                </div>
                <div className="mt-3">
                  <PileBar existing={bag.pieceCount} capacity={BAG_CAPACITY} label={`${bag.pieceCount} of ${BAG_CAPACITY}`} />
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-sm text-ink-dim">
                  <span className="min-w-0 truncate">{(bag.items ?? []).map((i) => `${nameOf(i.productId)} ${num(i.pieces)}`).join(" · ")}</span>
                  <span className="flex shrink-0 items-center gap-0.5 font-bold text-pile-soft">
                    {t("पूरी जानकारी", "Details")}
                    <ChevronRightIcon size={16} />
                  </span>
                </div>
              </button>
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
                              {!b.isFull && ` (${t("आधा", "part")})`} · {(b.items ?? []).map((x) => nameOf(x.productId)).join(", ") || "—"}
                            </span>
                          </span>
                          <Pill tone={daysSince(b.createdDate) >= 14 ? "danger" : "factory"} className="px-2 py-0.5 text-xs">
                            {daysSince(b.createdDate) === 0 ? t("आज", "today") : t(`${daysSince(b.createdDate)} दिन`, `${daysSince(b.createdDate)}d`)}
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

        {loose > 0 && can("tieSend") && (
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            className="min-h-[52px] shrink-0 rounded-2xl border border-dashed border-pile-line px-3 py-2 text-[15px] font-bold leading-[1.3] text-pile-soft"
          >
            {t("आधे भरे बैग भी बंद करें (सिर्फ़ फैक्ट्री जाने से पहले)", "Close part-filled bags too (only before a factory run)")}
            <br />
            <span className="font-medium text-pile-mute">{t("Close part-filled bags before a run", "सिर्फ़ फैक्ट्री जाने से पहले")}</span>
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

      {sheetBag && <BagSheet bag={sheetBag} partyOf={partyOf} nameOf={nameOf} onClose={() => setOpenBag(null)} />}

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t("आधे भरे बैग बंद करें?", "Close the part-filled bags?")}
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
            {t(`हाँ, ${filling.length} बैग बंद करो`, `Yes, close ${filling.length} bag${filling.length > 1 ? "s" : ""}`)}
          </BigButton>
        }
      >
        <p className="text-base leading-[1.4] text-ink-soft">
          {lang === "hi"
            ? `${company?.name} के ${filling.length} खुले बैग (${num(loose)} पीस) अभी बाँध दिए जाएँगे और फैक्ट्री भेजे जा सकेंगे। अगली गिनती से नए बैग खुलेंगे। यह तभी करें जब आज गाड़ी फैक्ट्री जा रही हो।`
            : `${company?.name}'s ${filling.length} open bags (${num(loose)} pieces) are tied now and can go to the factory. The next count opens new bags. Do this only when a run is leaving today.`}
        </p>
      </Dialog>
    </Screen>
  );
}

/** One bag in full: its items, and whose pickups they came from. */
function BagSheet({ bag, partyOf, nameOf, onClose }: { bag: SortedBag; partyOf: (id: string) => string; nameOf: (id: string) => string; onClose: () => void }) {
  const { t, lang } = useLang();
  const { companies, collections, countLines } = useStore();
  const company = companies.find((c) => c.id === bag.companyId);
  const parts = bagContents(bag, countLines);

  return (
    <Dialog
      open
      onClose={onClose}
      title={bag.bagNumber}
      description={`${company?.name} · MRP ₹${bag.mrp} · ${num(bag.pieceCount)} / ${BAG_CAPACITY} ${t("पीस", "pcs")} · ${
        bag.status === "open" ? t("भर रहा है", "being filled") : t("बँधा, भेजने को तैयार", "tied, ready to send")
      } · ${t("खुला", "opened")} ${fullDate(bag.createdDate, lang)}`}
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

      <p className="mb-2 text-[15px] font-bold">
        {t("किन पिकअप बैगों से आया", "From which pickup bags")} <span className="font-medium text-ink-faint">· {parts.length}</span>
      </p>
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
