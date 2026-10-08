"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { daysSince, fullDate, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { BAG_CAPACITY, NEAR_FULL, allPiles, bagContents, readyBags } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MrpCircle } from "@/components/ft/brand";
import { ChevronRightIcon, LayersIcon, SackIcon } from "@/components/ft/icons";
import { Pill } from "@/components/ft/kit";
import { BigButton, CompanyTabs, ListHeader, PileBar, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

/** Counted pieces lying loose, one pile per company and MRP. */
export function PilesBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useSession();
  const { t, lang } = useLang();
  const { companies, countLines, sortedBags, collections, distributors, tieFullBags, packPendingForCompany } = useStore();
  const [confirmLeftovers, setConfirmLeftovers] = useState(false);
  const [openPile, setOpenPile] = useState<number | null>(null);

  const tiers = useMemo(() => allPiles(countLines), [countLines]);
  const ready = useMemo(() => readyBags(sortedBags), [sortedBags]);
  // A company shows here while it has loose pieces or tied bags in the godown.
  const withPiles = companies.filter((c) => tiers.some((p) => p.companyId === c.id) || ready.some((b) => b.companyId === c.id));
  const fullCount = (id: string) => tiers.filter((p) => p.companyId === id).reduce((s, p) => s + p.fullBags, 0);

  // Open on the company with the most bags waiting to be tied.
  const fallback = [...withPiles].sort((a, b) => fullCount(b.id) - fullCount(a.id))[0]?.id ?? "";
  const requested = params.get("company");
  const [chosen, setChosen] = useState<string | null>(null);
  const companyId = chosen ?? (requested && withPiles.some((c) => c.id === requested) ? requested : fallback);
  const company = companies.find((c) => c.id === companyId);

  const piles = tiers
    .filter((p) => p.companyId === companyId)
    .sort((a, b) => b.fullBags - a.fullBags || b.remainder - a.remainder);
  const toTie = piles.reduce((s, p) => s + p.fullBags, 0);
  const tiedHere = ready.filter((b) => b.companyId === companyId);
  const tiedByMrp = Array.from(new Set(tiedHere.map((b) => b.mrp)))
    .sort((a, b) => a - b)
    .map((mrp) => ({ mrp, bags: tiedHere.filter((b) => b.mrp === mrp).sort((a, b) => a.bagNumber.localeCompare(b.bagNumber)) }));
  const partyOf = (collectionId: string) => distributors.find((d) => d.id === collections.find((c) => c.id === collectionId)?.distributorId)?.name ?? "—";
  const looseBagCount = (mrp: number) => new Set(countLines.filter((l) => !l.packed && l.companyId === companyId && l.mrp === mrp).map((l) => l.collectionId)).size;
  const loose = piles.reduce((s, p) => s + p.remainder, 0);

  const go = (ids: string[]) => ids.length && router.push(`/piles/tied?ids=${ids.join(",")}`);

  return (
    <Screen width="wide">
      <ListHeader tone="pile" icon={<LayersIcon size={26} />} title={t("ढेर · Piles", "Piles · ढेर")} subtitle={t("गिना हुआ माल, MRP के हिसाब से", "Counted goods, by MRP")}>
        {withPiles.length > 0 && (
          <CompanyTabs
            companies={withPiles}
            value={companyId}
            onChange={setChosen}
            tone="pile"
            counts={Object.fromEntries(
              withPiles.filter((c) => c.id !== companyId).map((c) => [c.id, fullCount(c.id) > 0 ? `${fullCount(c.id)} ✓` : "0"])
            )}
          />
        )}
      </ListHeader>

      <ScreenBody className="gap-2.5">
        {piles.length === 0 && tiedHere.length > 0 && (
          <p className="rounded-2xl bg-surface p-3.5 text-[15px] text-ink-dim">{t("कोई खुला माल नहीं — सब बैग में बँध चुका है", "No loose pieces — everything is tied into bags")}</p>
        )}
        {piles.length === 0 && tiedHere.length === 0 && (
          <div className="rounded-[20px] border border-line bg-surface px-4 py-10 text-center">
            <p className="font-display text-2xl font-extrabold">{t("कोई ढेर नहीं", "No piles")}</p>
            <p className="mt-1 text-ink-dim">{t("बैग गिनने के बाद माल यहाँ दिखेगा", "Counted goods show up here")}</p>
          </div>
        )}

        <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
          {piles.map((pile) => {
            const full = pile.fullBags > 0;
            const need = BAG_CAPACITY - pile.remainder;
            return (
              <section
                key={pile.mrp}
                role="button"
                tabIndex={0}
                onClick={() => setOpenPile(pile.mrp)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpenPile(pile.mrp)}
                aria-label={t(`₹${pile.mrp} ढेर की पूरी जानकारी`, `₹${pile.mrp} pile details`)}
                className={cn("cursor-pointer rounded-[20px] p-3.5 transition-colors", full ? "border-2 border-pile bg-pile-deep" : "border border-line bg-surface hover:bg-elevated")}
              >
                <div className="flex items-center gap-3">
                  <MrpCircle mrp={pile.mrp} size={56} />
                  <span className="flex-1">
                    <span className="block font-display text-[26px] font-extrabold leading-none">
                      {num(pile.pieces)} {t("पीस", "pcs")}
                    </span>
                    {full ? (
                      <span className="block text-[15px] font-bold text-pile-soft">
                        {t(
                          `${pile.fullBags} पूरे बैग${pile.remainder ? ` + ${num(pile.remainder)} पीस` : ""}`,
                          `${pile.fullBags} full bag${pile.fullBags > 1 ? "s" : ""}${pile.remainder ? ` + ${num(pile.remainder)} pcs` : ""}`
                        )}
                      </span>
                    ) : need <= NEAR_FULL ? (
                      <span className="block text-[15px] font-bold text-count-soft">{t(`सिर्फ़ ${need} और चाहिए`, `Only ${need} more needed`)}</span>
                    ) : (
                      <span className="block text-[15px] font-semibold text-ink-dim">
                        {num(need)} {t("और चाहिए", "more needed")}
                      </span>
                    )}
                  </span>
                  {full && (
                    <span className="rounded-full bg-pile px-3 py-1.5 text-[15px] font-extrabold text-pile-ink">
                      {pile.fullBags} {t("तैयार", "ready")}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {Array.from({ length: Math.min(pile.fullBags, 6) }, (_, i) => (
                    <span key={i} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-pile text-pile-ink">
                      <SackIcon size={22} />
                    </span>
                  ))}
                  {pile.fullBags > 6 && <span className="text-sm font-bold text-pile-soft">+{pile.fullBags - 6}</span>}
                  <div className="flex-1">
                    <PileBar existing={pile.remainder} capacity={BAG_CAPACITY} label={`${pile.remainder} of ${BAG_CAPACITY}`} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-sm text-ink-dim">
                  <span>
                    {t(`${looseBagCount(pile.mrp)} पिकअप बैग से`, `from ${looseBagCount(pile.mrp)} pickup bags`)}
                    {tiedHere.some((b) => b.mrp === pile.mrp) && ` · ${t(`${tiedHere.filter((b) => b.mrp === pile.mrp).length} बैग बँधे`, `${tiedHere.filter((b) => b.mrp === pile.mrp).length} tied`)}`}
                  </span>
                  <span className="flex items-center gap-0.5 font-bold text-pile-soft">
                    {t("पूरी जानकारी", "Details")}
                    <ChevronRightIcon size={16} />
                  </span>
                </div>
              </section>
            );
          })}
        </div>

        {tiedByMrp.length > 0 && (
          <section className="mt-2 flex flex-col gap-2">
            <h2 className="mx-0.5 font-display text-[21px] font-extrabold">
              {t("गोदाम में बँधे बैग", "Tied bags in the godown")}{" "}
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
                    {bags.map((b, i) => {
                      const names = Array.from(new Set(bagContents(b, countLines).map((c) => partyOf(c.collectionId))));
                      return (
                        <li key={b.id}>
                          <Link href={`/sorted-bags?q=${b.bagNumber}`} className="flex items-center gap-2.5 py-2">
                            <span className="w-6 shrink-0 text-right text-sm font-bold text-ink-faint">{i + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-[15px] font-semibold">{b.bagNumber}</span>
                              <span className="block truncate text-[13px] text-ink-dim">
                                {num(b.pieceCount)} {t("पीस", "pcs")}
                                {!b.isFull && ` (${t("आधा", "part")})`} · {names.length ? `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ""}` : "—"}
                              </span>
                            </span>
                            <Pill tone={daysSince(b.createdDate) >= 14 ? "danger" : "factory"} className="px-2 py-0.5 text-xs">
                              {daysSince(b.createdDate) === 0 ? t("आज", "today") : t(`${daysSince(b.createdDate)} दिन`, `${daysSince(b.createdDate)}d`)}
                            </Pill>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {loose > 0 && can("tieSend") && (
          <button
            type="button"
            onClick={() => setConfirmLeftovers(true)}
            className="min-h-[52px] shrink-0 rounded-2xl border border-dashed border-pile-line px-3 py-2 text-[15px] font-bold leading-[1.3] text-pile-soft"
          >
            {t("बचे पीस भी बाँधो (सिर्फ़ फैक्ट्री जाने से पहले)", "Pack leftovers as part-filled bags")}
            <br />
            <span className="font-medium text-pile-mute">{t("Pack leftovers as part-filled bags", "सिर्फ़ फैक्ट्री जाने से पहले")}</span>
          </button>
        )}
      </ScreenBody>

      {can("tieSend") && toTie > 0 && (
        <ScreenFooter className="py-2.5">
          <BigButton tone="pile" className="h-[60px]" onClick={() => go(tieFullBags(companyId).map((b) => b.id))}>
            <SackIcon />
            {t(`${toTie} भरे बैग बाँधो · Tie ${toTie} bag${toTie > 1 ? "s" : ""}`, `Tie ${toTie} full bag${toTie > 1 ? "s" : ""}`)}
          </BigButton>
        </ScreenFooter>
      )}

      {openPile !== null && company && <PileSheet companyId={company.id} mrp={openPile} onClose={() => setOpenPile(null)} />}

      <Dialog
        open={confirmLeftovers}
        onClose={() => setConfirmLeftovers(false)}
        title={t("बचे पीस भी बाँधें?", "Pack the leftovers too?")}
        footer={
          <BigButton
            tone="pile"
            onClick={() => {
              setConfirmLeftovers(false);
              go(packPendingForCompany(companyId).bags.map((b) => b.id));
            }}
          >
            {t("हाँ, सब बाँधो", "Yes, pack everything")}
          </BigButton>
        }
      >
        <p className="text-base leading-[1.4] text-ink-soft">
          {lang === "hi"
            ? `${company?.name} के सारे ढेर बैग में चले जाएँगे — ${num(loose)} बचे पीस आधे भरे बैग बनेंगे। यह तभी करें जब आज गाड़ी फैक्ट्री जा रही हो।`
            : `Every ${company?.name} pile goes into bags — the ${num(loose)} loose pieces become part-filled bags. Do this only when a factory run is leaving today.`}
        </p>
        <Link href="/send" className="mt-3 inline-block text-sm font-bold text-factory">
          {t("तैयार बैग देखें →", "See ready bags →")}
        </Link>
      </Dialog>
    </Screen>
  );
}

/** One pile in full: every pickup bag whose pieces lie in it, item by item, and the bags already tied from it. */
function PileSheet({ companyId, mrp, onClose }: { companyId: string; mrp: number; onClose: () => void }) {
  const { t, lang } = useLang();
  const { companies, countLines, collections, distributors, products, sortedBags } = useStore();
  const company = companies.find((c) => c.id === companyId);
  const loose = countLines.filter((l) => !l.packed && l.companyId === companyId && l.mrp === mrp);
  const total = loose.reduce((s, l) => s + l.quantity, 0);

  // Oldest pickup first: the order its pieces go into the next bag.
  const pickups = Array.from(new Set(loose.map((l) => l.collectionId)))
    .map((id) => {
      const bag = collections.find((c) => c.id === id);
      const items = Array.from(
        loose.filter((l) => l.collectionId === id).reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>())
      );
      return { id, bag, items, pieces: items.reduce((s, [, q]) => s + q, 0) };
    })
    .sort((a, b) => (a.bag?.collectedDate ?? "").localeCompare(b.bag?.collectedDate ?? "") || (a.bag?.bagNumber ?? "").localeCompare(b.bag?.bagNumber ?? ""));
  const tied = readyBags(sortedBags, companyId)
    .filter((b) => b.mrp === mrp)
    .sort((a, b) => a.bagNumber.localeCompare(b.bagNumber));

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`${company?.name} · ₹${mrp} का ढेर`, `${company?.name} · ₹${mrp} pile`)}
      description={t(
        `${num(total)} पीस खुले · ${pickups.length} पिकअप बैग से · ${tied.length} बैग बँधे`,
        `${num(total)} loose pieces · from ${pickups.length} pickup bags · ${tied.length} tied`
      )}
    >
      <p className="mb-2 text-[15px] font-bold">
        {t("ढेर में किसका माल है", "What is in the pile")} <span className="font-medium text-ink-faint">· {t("पुराना पहले", "oldest first")}</span>
      </p>
      {pickups.length === 0 && <p className="text-ink-dim">{t("ढेर ख़ाली है", "The pile is empty")}</p>}
      <div className="flex flex-col gap-2">
        {pickups.map((p, i) => (
          <Link key={p.id} href={`/collections/${p.id}`} className="block rounded-2xl bg-elevated p-3 hover:bg-raised">
            <div className="flex items-center gap-2.5">
              <span className="w-6 shrink-0 text-right text-sm font-bold text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[15px] font-semibold">{p.bag?.bagNumber ?? "—"}</span>
                <span className="block truncate text-[13px] text-ink-dim">
                  {distributors.find((d) => d.id === p.bag?.distributorId)?.name ?? "—"}
                  {p.bag?.countedDate ? ` · ${t("गिना", "counted")} ${fullDate(p.bag.countedDate, lang)}` : ""}
                </span>
              </span>
              <b className="shrink-0">
                {num(p.pieces)} {t("पीस", "pcs")}
              </b>
            </div>
            <div className="mt-1.5 flex flex-col gap-0.5 pl-[34px] text-[13px] text-ink-dim">
              {p.items.map(([productId, qty]) => (
                <span key={productId} className="flex justify-between gap-2">
                  <span className="truncate">{products.find((x) => x.id === productId)?.name ?? "—"}</span>
                  <span>{num(qty)}</span>
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {tied.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-[15px] font-bold">
            {t("इस ढेर से बँधे बैग", "Bags tied from this pile")} <span className="font-medium text-ink-faint">· {tied.length}</span>
          </p>
          <div className="flex flex-col divide-y divide-line rounded-2xl bg-elevated px-3">
            {tied.map((b) => (
              <Link key={b.id} href={`/sorted-bags?q=${b.bagNumber}`} className="flex items-center gap-2.5 py-2.5">
                <SackIcon size={18} className="shrink-0 text-pile" />
                <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold">{b.bagNumber}</span>
                <span className="text-sm text-ink-dim">
                  {num(b.pieceCount)} {t("पीस", "pcs")}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
