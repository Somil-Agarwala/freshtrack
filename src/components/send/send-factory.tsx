"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { daysSince, inr, lakhShort, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { BAG_CAPACITY, mrpBreakdown, partySharesForBags, readyBags, sumValue } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MrpCircle } from "@/components/ft/brand";
import { CheckIcon, SendIcon } from "@/components/ft/icons";
import { BigButton, CompanyTabs, ListHeader, Screen, ScreenBody, ScreenFooter } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

/** Tied bags of one company going to its factory in one run. */
export function SendFactory() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useSession();
  const { t, sub, lang } = useLang();
  const { companies, sortedBags, createDispatch, collections, countLines, distributors } = useStore();
  const ready = useMemo(() => readyBags(sortedBags), [sortedBags]);
  const withBags = companies.filter((c) => ready.some((b) => b.companyId === c.id));
  const countFor = (id: string) => ready.filter((b) => b.companyId === id).length;

  const requested = params.get("company");
  const [chosen, setChosen] = useState<string | null>(null);
  const fallback = [...withBags].sort((a, b) => countFor(b.id) - countFor(a.id))[0]?.id ?? "";
  const companyId = chosen ?? (requested && withBags.some((c) => c.id === requested) ? requested : fallback);
  const company = companies.find((c) => c.id === companyId);
  const bags = ready.filter((b) => b.companyId === companyId).sort((a, b) => a.bagNumber.localeCompare(b.bagNumber));

  // Every bag goes unless someone takes it out.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const selected = bags.filter((b) => !removed.has(b.id));
  const pieces = selected.reduce((s, b) => s + b.pieceCount, 0);
  const value = sumValue(selected);
  const shares = partySharesForBags(selected, collections, countLines);

  function pickCompany(id: string) {
    setChosen(id);
    setRemoved(new Set());
  }

  function send() {
    const dispatch = createDispatch(selected.map((b) => b.id));
    if (dispatch) router.push(`/send/${dispatch.id}`);
  }

  return (
    <Screen width="wide">
      <ListHeader
        tone="factory"
        icon={<SendIcon size={26} />}
        title={t("फैक्ट्री भेजो", "Send to factory")}
        subtitle={lang === "hi" ? "Send to factory · एक बार में एक कंपनी" : "One company at a time · एक बार में एक कंपनी"}
      >
        {withBags.length > 0 && (
          <CompanyTabs
            companies={withBags}
            value={companyId}
            onChange={pickCompany}
            tone="factory"
            counts={Object.fromEntries(withBags.map((c) => [c.id, c.id === companyId ? `${countFor(c.id)} ${t("बैग", "bags")}` : countFor(c.id)]))}
          />
        )}
      </ListHeader>

      <ScreenBody className="gap-3">
        {!company || bags.length === 0 ? (
          <div className="rounded-[20px] border border-line bg-surface px-4 py-10 text-center">
            <p className="font-display text-2xl font-extrabold">{t("भेजने को कोई बैग नहीं", "No bags to send")}</p>
            <p className="mt-1 text-ink-dim">{t("ढेर से बैग बाँधने के बाद यहाँ दिखेंगे", "Bags show up here once tied from the piles")}</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <section className="rounded-[20px] border border-factory-line bg-factory-panel p-4">
              <p className="text-[15px] font-bold text-factory-soft">{t(`${company.name} फैक्ट्री के लिए तैयार`, `Ready for the ${company.name} factory`)}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <Stat value={String(selected.length)} label={t("बैग", "bags")} />
                <Stat value={num(pieces)} label={t("पीस", "pieces")} />
                <Stat value={lakhShort(value)} label={t("क्लेम", "claim")} accent />
              </div>
            </section>

            <div className="flex flex-col gap-3">
              <p className="mx-0.5 text-base font-bold">
                {t("MRP के हिसाब से", "By MRP")} <span className="font-medium text-ink-faint">· {sub("MRP के हिसाब से", "By MRP")}</span>
              </p>
              <div className="flex flex-col gap-2">
                {mrpBreakdown(selected).map((row) => (
                  <div key={`${row.mrp}-${row.full}`} className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5">
                    <MrpCircle mrp={row.mrp} size={44} />
                    <span className="flex-1 text-[17px] font-bold">
                      {row.bags} {t("बैग", row.bags === 1 ? "bag" : "bags")}{" "}
                      <span className="font-medium text-ink-faint">
                        {row.full ? `× ${BAG_CAPACITY}` : `· ${num(row.pieces)} ${t("पीस", "pcs")} (${t("आधा", "part-filled")})`}
                      </span>
                    </span>
                    <span className="text-[17px] font-bold">{inr(row.value)}</span>
                  </div>
                ))}
              </div>

              {shares.length > 0 && (
                <>
                  <p className="mx-0.5 text-base font-bold">
                    {t("किसका माल जा रहा है", "Whose goods are going")} <span className="font-medium text-ink-faint">· {shares.length}</span>
                  </p>
                  <div className="flex flex-col divide-y divide-line rounded-2xl bg-surface px-3.5">
                    {shares.map((s) => (
                      <div key={s.distributorId} className="flex items-center justify-between gap-2 py-2.5 text-[15px]">
                        <span className="min-w-0 truncate font-semibold">{distributors.find((d) => d.id === s.distributorId)?.name ?? "—"}</span>
                        <span className="shrink-0 text-ink-dim">
                          {num(s.pieces)} {t("पीस", "pcs")} · <b className="text-ink">{inr(s.value)}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-3.5 py-3">
                <span className="flex items-center gap-2.5 text-base font-bold">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-factory text-factory-ink">
                    <CheckIcon size={16} />
                  </span>
                  {selected.length === bags.length
                    ? t(`सारे ${bags.length} बैग चुने हैं`, `All ${bags.length} bags selected`)
                    : t(`${bags.length} में से ${selected.length} बैग चुने`, `${selected.length} of ${bags.length} bags selected`)}
                </span>
                <button type="button" onClick={() => setPicking(true)} className="h-11 rounded-xl bg-elevated px-3 text-[15px] font-bold text-factory-soft">
                  {t("बैग हटाएँ", "Remove bags")}
                </button>
              </div>
            </div>
          </div>
        )}
      </ScreenBody>

      {can("tieSend") && company && selected.length > 0 && (
        <ScreenFooter className="py-2.5">
          <BigButton tone="factory" onClick={send} className="flex-col gap-0">
            {t(`${selected.length} बैग फैक्ट्री भेजो`, `Send ${selected.length} bag${selected.length > 1 ? "s" : ""} to the factory`)}
            <span className="font-sans text-sm font-bold">
              {t(`Send to ${company.name}`, `${company.name} को भेजो`)} · {inr(value)}
            </span>
          </BigButton>
        </ScreenFooter>
      )}

      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title={t("कौन से बैग जाएँगे?", "Which bags go?")}
        description={t("जो बैग इस गाड़ी में नहीं जा रहे, उनका निशान हटाएँ", "Untick the bags that are not on this run")}
        footer={
          <BigButton tone="factory" onClick={() => setPicking(false)}>
            {t(`ठीक है · ${selected.length} बैग`, `Done · ${selected.length} bags`)}
          </BigButton>
        }
      >
        <div className="flex flex-col gap-2">
          {bags.map((bag) => {
            const on = !removed.has(bag.id);
            return (
              <button
                key={bag.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setRemoved((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(bag.id);
                    else next.delete(bag.id);
                    return next;
                  })
                }
                className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left", on ? "border-factory-line bg-factory-panel" : "border-line bg-canvas opacity-70")}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2", on ? "border-factory bg-factory text-factory-ink" : "border-line-strong")}>
                  {on && <CheckIcon size={16} />}
                </span>
                <MrpCircle mrp={bag.mrp} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-base font-semibold">{bag.bagNumber}</span>
                  <span className="block text-sm text-ink-dim">
                    {num(bag.pieceCount)} {t("पीस", "pcs")} · {t(`${daysSince(bag.createdDate)} दिन से तैयार`, `ready ${daysSince(bag.createdDate)} days`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Dialog>
    </Screen>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={cn("font-display text-[30px] font-extrabold leading-none max-[380px]:text-[26px]", accent && "text-factory")}>{value}</p>
      <p className="text-sm text-factory-mute">{label}</p>
    </div>
  );
}
