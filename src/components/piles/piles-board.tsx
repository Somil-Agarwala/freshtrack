"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { BAG_CAPACITY, NEAR_FULL, allPiles } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MrpCircle } from "@/components/ft/brand";
import { LayersIcon, SackIcon } from "@/components/ft/icons";
import { BigButton, CompanyTabs, ListHeader, PileBar, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

/** Counted pieces lying loose, one pile per company and MRP. */
export function PilesBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang } = useLang();
  const { companies, countLines, tieFullBags, packPendingForCompany } = useStore();
  const [confirmLeftovers, setConfirmLeftovers] = useState(false);

  const tiers = useMemo(() => allPiles(countLines), [countLines]);
  const withPiles = companies.filter((c) => tiers.some((p) => p.companyId === c.id));
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
        {piles.length === 0 && (
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
              <section key={pile.mrp} className={cn("rounded-[20px] p-3.5", full ? "border-2 border-pile bg-pile-deep" : "border border-line bg-surface")}>
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
              </section>
            );
          })}
        </div>

        {loose > 0 && (
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

      {toTie > 0 && (
        <ScreenFooter className="py-2.5">
          <BigButton tone="pile" className="h-[60px]" onClick={() => go(tieFullBags(companyId).map((b) => b.id))}>
            <SackIcon />
            {t(`${toTie} भरे बैग बाँधो · Tie ${toTie} bag${toTie > 1 ? "s" : ""}`, `Tie ${toTie} full bag${toTie > 1 ? "s" : ""}`)}
          </BigButton>
        </ScreenFooter>
      )}

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
