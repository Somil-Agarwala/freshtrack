"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useFlash } from "@/lib/device";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { waitingByMrp } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Company, SortedBag } from "@/types";
import { BagNumber } from "@/components/ft/bag-number";
import { CompanyAvatar, MrpCircle } from "@/components/ft/brand";
import { CheckIcon, MinusIcon, PlusIcon, SackIcon } from "@/components/ft/icons";
import { BigButton, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { TiedDialog } from "./tied-dialog";

/**
 * Filling a bag. Counted goods wait here, by MRP. Staff take a bag, write
 * its number on it, put goods in, and type how many of each item went in --
 * with shortcuts: "all" for one item, "all waiting goods", or "this
 * pickup's goods". When the bag is full they tie it; if goods are still
 * waiting, the next bag's number appears at once.
 */
export function FillScreen() {
  const params = useSearchParams();
  const { companies, countLines } = useStore();
  const company = companies.find((c) => c.id === params.get("company"));
  const waiting = useMemo(() => (company ? waitingByMrp(countLines, company.id) : []), [countLines, company]);
  if (!company) {
    return (
      <Screen>
        <ScreenBody className="items-center justify-center text-center">
          <Link href="/piles" className="font-bold text-pile">
            Bags · बैग
          </Link>
        </ScreenBody>
      </Screen>
    );
  }
  const asked = Number(params.get("mrp"));
  const mrp = asked || waiting[0]?.mrp || 0;
  return <Filler key={`${company.id}:${mrp}`} company={company} mrp={mrp} from={params.get("from") ?? undefined} />;
}

function Filler({ company, mrp, from }: { company: Company; mrp: number; from?: string }) {
  const router = useRouter();
  const { t, sub } = useLang();
  const { can } = useSession();
  const { countLines, sortedBags, products, fillBag, tieBag, previewBagNumber } = useStore();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [tiedNow, setTiedNow] = useState<{ tied: SortedBag; next: SortedBag | null } | null>(null);
  const [takingOut, setTakingOut] = useState<string | null>(null);
  const [message, flash] = useFlash();

  const waitingAll = waitingByMrp(countLines, company.id);
  const here = waitingAll.find((w) => w.mrp === mrp);
  const openHere = sortedBags.filter((b) => b.status === "open" && b.companyId === company.id && b.mrp === mrp).sort((a, b) => a.bagNumber.localeCompare(b.bagNumber));
  const bag = openHere[0];
  // MRPs with goods waiting, or a bag being filled.
  const mrps = Array.from(new Set([...waitingAll.map((w) => w.mrp), ...sortedBags.filter((b) => b.status === "open" && b.companyId === company.id).map((b) => b.mrp), ...(mrp ? [mrp] : [])])).sort((a, b) => a - b);
  const order = new Map(products.map((p, i) => [p.id, i]));
  const items = (here?.items ?? []).slice().sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  // What the pickup just counted has waiting here: the "this pickup" shortcut.
  const fromHere = from
    ? countLines
        .filter((l) => !l.bagId && l.collectionId === from && l.companyId === company.id && l.mrp === mrp)
        .reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>())
    : new Map<string, number>();
  const fromPieces = Array.from(fromHere.values()).reduce((s, n) => s + n, 0);

  const entered = items.map((i) => ({ productId: i.productId, pieces: Math.min(qty[i.productId] ?? 0, i.pieces) })).filter((i) => i.pieces > 0);
  const putting = entered.reduce((s, i) => s + i.pieces, 0);
  const inBag = bag?.pieceCount ?? 0;
  const set = (id: string, n: number, max: number) => setQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(max, Math.round(n) || 0)) }));

  function put(andTie: boolean) {
    let bagId = bag?.id;
    let bagNumber = bag?.bagNumber;
    if (putting > 0) {
      const res = fillBag(company.id, mrp, entered, from);
      if (!res) return;
      bagId = res.bag.id;
      bagNumber = res.bag.bagNumber;
      setQty({});
      if (!andTie) flash(t(`✓ ${num(res.added)} पीस बैग ${bagNumber.slice(-4)} में डाले`, `✓ ${num(res.added)} pcs put in bag ${bagNumber.slice(-4)}`));
    }
    if (andTie && bagId) {
      const res = tieBag(bagId);
      if (res) setTiedNow(res);
    }
  }

  const moreMrps = waitingAll.filter((w) => w.mrp !== mrp);

  return (
    <Screen>
      <TaskHeader back={`/piles?company=${company.id}`} tone="pile" kicker={`${t("बैग भरें", "Fill a bag")} · ${company.name}`} aside={<CompanyAvatar company={company} size={44} />}>
        <h1 className="font-display text-2xl font-extrabold leading-tight">{t(`₹${mrp} का बैग`, `₹${mrp} bag`)}</h1>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        {mrps.length > 1 && (
          <div role="tablist" aria-label="MRP" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {mrps.map((m) => {
              const w = waitingAll.find((x) => x.mrp === m);
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={m === mrp}
                  onClick={() => router.replace(`/fill?company=${company.id}&mrp=${m}${from ? `&from=${from}` : ""}`)}
                  className={cn("flex h-12 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-base", m === mrp ? "bg-pile font-bold text-pile-ink" : "border border-line bg-surface font-semibold")}
                >
                  <MrpCircle mrp={m} size={36} />
                  {w ? num(w.pieces) : "✓"}
                </button>
              );
            })}
          </div>
        )}

        {/* The bag: its number to write on it, and what is in it so far. */}
        <section className="rounded-[20px] border-2 border-pile bg-pile-deep p-3.5">
          <p className="text-[15px] font-bold text-pile-soft">
            {bag ? t("भर रहा बैग — बैग पर यह नंबर लिखें", "Bag being filled — write this number on it") : t("नया बैग — खाली बैग पर यह नंबर लिखें", "New bag — write this number on an empty bag")}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <MrpCircle mrp={mrp} size={52} />
            <BagNumber value={bag?.bagNumber ?? previewBagNumber(company.id, mrp)} className="block min-w-0 break-all text-[30px]" />
          </div>
          <p className="mt-2 flex items-baseline justify-between text-[15px] text-ink-dim">
            <span>{t("बैग में अब", "In the bag now")}</span>
            <b className="font-display text-xl text-ink">
              {num(inBag)} {t("पीस", "pcs")}
              {putting > 0 && <span className="text-count"> + {num(putting)}</span>}
            </b>
          </p>
          {bag && (bag.items ?? []).length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-line rounded-2xl bg-elevated px-3 py-0.5">
              {(bag.items ?? []).map((i) => (
                <li key={i.productId} className="flex items-center gap-2 py-1.5 text-[15px]">
                  <span className="min-w-0 flex-1 truncate">{nameOf(i.productId)}</span>
                  <b>{num(i.pieces)}</b>
                  <button type="button" onClick={() => setTakingOut(i.productId)} className="rounded-lg px-2 py-1 text-sm font-bold text-ink-dim hover:bg-raised">
                    {t("निकालें", "Take out")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {items.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-center text-base text-ink-dim">
            {t(`₹${mrp} का कोई माल बैग में डालना बाकी नहीं`, `No ₹${mrp} goods waiting to go into a bag`)}
          </p>
        ) : (
          <>
            <p className="mx-0.5 font-display text-[21px] font-extrabold leading-tight">
              {t("बैग में कितना डाला?", "How many went into the bag?")} <span className="font-sans text-sm font-medium text-ink-faint">· {sub("बैग में कितना डाला?", "How many went in?")}</span>
            </p>

            {/* Shortcuts. */}
            <div className="flex flex-wrap gap-2">
              {fromPieces > 0 && (
                <button
                  type="button"
                  onClick={() => setQty(Object.fromEntries(fromHere))}
                  className="h-12 rounded-2xl bg-count px-3.5 text-[15px] font-extrabold text-count-ink hover:brightness-110"
                >
                  {t(`अभी गिना माल · ${num(fromPieces)}`, `Just counted · ${num(fromPieces)}`)}
                </button>
              )}
              <button
                type="button"
                onClick={() => setQty(Object.fromEntries(items.map((i) => [i.productId, i.pieces])))}
                className="h-12 rounded-2xl bg-pile-tint px-3.5 text-[15px] font-extrabold text-pile-soft hover:brightness-125"
              >
                {t(`सारा बाकी माल · ${num(here?.pieces ?? 0)}`, `All waiting · ${num(here?.pieces ?? 0)}`)}
              </button>
              {putting > 0 && (
                <button type="button" onClick={() => setQty({})} className="h-12 rounded-2xl bg-elevated px-3.5 text-[15px] font-bold text-ink-dim">
                  {t("साफ़ करें", "Clear")}
                </button>
              )}
            </div>

            <ul className="flex flex-col divide-y divide-line rounded-[18px] border border-line bg-surface">
              {items.map((i) => {
                const n = Math.min(qty[i.productId] ?? 0, i.pieces);
                return (
                  <li key={i.productId} className={cn("flex flex-col gap-2 px-3.5 py-3", n > 0 && "bg-money-tint/30")}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[17px] font-bold">{nameOf(i.productId)}</span>
                      <span className="shrink-0 text-sm text-ink-dim">
                        {t("बाकी", "waiting")} <b className="text-ink">{num(i.pieces)}</b>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={t("कम करें", "Less")} onClick={() => set(i.productId, n - 1, i.pieces)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elevated">
                        <MinusIcon size={20} />
                      </button>
                      <input
                        aria-label={`${nameOf(i.productId)} — ${t("बैग में डाले", "put in the bag")}`}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={n ? String(n) : ""}
                        placeholder="0"
                        onChange={(e) => set(i.productId, Number(e.target.value.replace(/\D/g, "")), i.pieces)}
                        className={cn("h-12 min-w-0 flex-1 rounded-xl border bg-canvas px-3 text-center font-display text-2xl font-bold text-ink outline-none focus:border-pile", n ? "border-pile" : "border-line")}
                      />
                      <button type="button" aria-label={t("ज़्यादा करें", "More")} onClick={() => set(i.productId, n + 1, i.pieces)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elevated">
                        <PlusIcon size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => set(i.productId, i.pieces, i.pieces)}
                        className={cn("h-12 shrink-0 rounded-xl px-3 text-[15px] font-extrabold", n === i.pieces ? "bg-money text-money-ink" : "bg-pile-tint text-pile-soft")}
                      >
                        {t(`सब ${num(i.pieces)}`, `All ${num(i.pieces)}`)}
                      </button>
                    </div>
                    {n > 0 && n < i.pieces && (
                      <p className="text-sm text-ink-dim">
                        {t(`बाहर बचेंगे ${num(i.pieces - n)} — अगले बैग में जाएँगे`, `${num(i.pieces - n)} stay outside — for the next bag`)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {moreMrps.length > 0 && items.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="mx-0.5 text-[15px] font-bold text-ink-dim">{t("दूसरे MRP का माल बाकी है", "Other MRPs have goods waiting")}</p>
            <div className="flex flex-wrap gap-2">
              {moreMrps.map((w) => (
                <Link key={w.mrp} href={`/fill?company=${company.id}&mrp=${w.mrp}`} className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-3.5 font-bold">
                  <MrpCircle mrp={w.mrp} size={36} />
                  {num(w.pieces)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </ScreenBody>

      <ScreenFooter className="gap-2">
        {(putting > 0 || inBag > 0) && (
          <p className="px-1 text-[15px] text-ink-dim">
            {putting > 0 ? t(`अभी डाल रहे: ${num(putting)} पीस`, `Putting in now: ${num(putting)} pcs`) : t("कुछ नहीं लिखा", "Nothing entered")} ·{" "}
            {t("बैग में कुल", "bag total")} <b className="text-ink">{num(inBag + putting)}</b>
          </p>
        )}
        <div className="grid grid-cols-[1fr_1.35fr] gap-2">
          <button
            type="button"
            disabled={putting === 0}
            onClick={() => put(false)}
            className="flex h-16 items-center justify-center gap-1.5 rounded-[18px] border-2 border-pile px-2 text-center font-display text-[17px] font-extrabold leading-tight text-pile-soft disabled:opacity-40"
          >
            <CheckIcon size={20} className="shrink-0" />
            {t("डाल दिया", "Put in")}
          </button>
          <BigButton tone="pile" disabled={!can("tieSend") || inBag + putting === 0} onClick={() => put(true)} className="h-16 px-2 text-[17px] leading-tight">
            <SackIcon size={22} className="shrink-0" />
            {putting > 0 ? t("डाला · बैग भरा — बाँधें", "Put in · full — tie") : t("बैग भर गया — बाँधें", "Bag full — tie it")}
          </BigButton>
        </div>
      </ScreenFooter>

      {takingOut && bag && <TakeOut bag={bag} productId={takingOut} name={nameOf(takingOut)} onClose={() => setTakingOut(null)} />}

      {tiedNow && (
        <TiedDialog
          result={tiedNow}
          onClose={() => setTiedNow(null)}
          onNext={() => setTiedNow(null)}
          after={moreMrps.length ? { href: `/fill?company=${company.id}&mrp=${moreMrps[0].mrp}`, label: t(`₹${moreMrps[0].mrp} का माल भरें`, `Fill ₹${moreMrps[0].mrp} goods`) } : { href: `/piles?company=${company.id}`, label: t("बैगों की सूची", "All bags") }}
        />
      )}
      <Notice message={message} />
    </Screen>
  );
}

/** A mistake while filling: take pieces of one item back out of the bag. */
function TakeOut({ bag, productId, name, onClose }: { bag: SortedBag; productId: string; name: string; onClose: () => void }) {
  const { t } = useLang();
  const { takeOutOfBag } = useStore();
  const inside = (bag.items ?? []).find((i) => i.productId === productId)?.pieces ?? 0;
  const [n, setN] = useState(0);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("बैग से माल निकालें", "Take goods out of the bag")}
      description={`${name} · ${t("बैग में", "in the bag")} ${num(inside)}`}
      footer={
        <BigButton
          tone="neutral"
          disabled={n <= 0}
          onClick={() => {
            takeOutOfBag(bag.id, productId, n);
            onClose();
          }}
        >
          {t(`${num(n)} पीस निकालें`, `Take out ${num(n)} pcs`)}
        </BigButton>
      }
    >
      <div className="flex items-center gap-2">
        <input
          autoFocus
          inputMode="numeric"
          value={n ? String(n) : ""}
          placeholder="0"
          onChange={(e) => setN(Math.min(inside, Number(e.target.value.replace(/\D/g, "")) || 0))}
          className="h-14 min-w-0 flex-1 rounded-2xl border border-line bg-canvas px-4 text-center font-display text-2xl font-bold text-ink outline-none focus:border-pile"
        />
        <button type="button" onClick={() => setN(inside)} className="h-14 shrink-0 rounded-2xl bg-elevated px-4 text-base font-bold">
          {t(`सब ${num(inside)}`, `All ${num(inside)}`)}
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-dim">{t("निकाला माल फिर से 'बाकी' में आ जाएगा", "What you take out goes back to waiting")}</p>
    </Dialog>
  );
}
