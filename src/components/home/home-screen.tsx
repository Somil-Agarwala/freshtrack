"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { longDate, lakh, weekdayEn } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { awaitingPayment, fullBagsWaiting, readyBags, staleUncounted, sumValue, STALE_COUNT_DAYS } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { today } from "@/lib/utils";
import { OPEN_STATUSES } from "@/lib/constants";
import { AlertIcon, ChevronRightIcon, ClipboardIcon, LayersIcon, MenuIcon, PlusIcon, RupeeIcon, SendIcon, TruckIcon, WarehouseIcon } from "@/components/ft/icons";
import { LangToggle } from "@/components/layout/lang-toggle";

/** Phone home: what to do today, in the order the work flows. */
export function HomeScreen() {
  const { t, lang } = useLang();
  const { userName } = useSettings();
  const { collections, countLines, sortedBags, dispatches, records } = useStore();
  const toReview = records.filter((r) => OPEN_STATUSES.includes(r.status)).length;

  const uncounted = collections.filter((c) => c.status === "uncounted").length;
  const stale = staleUncounted(collections).length;
  const toTie = fullBagsWaiting(countLines);
  const ready = readyBags(sortedBags);
  const owed = awaitingPayment(dispatches);
  const owedValue = owed.reduce((s, d) => s + d.claimedValue, 0);
  const date = today();
  const [owedAmount, owedUnit] = lakhParts(owedValue, lang);

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col">
      <header className="flex items-center justify-between px-5 pb-2.5 pt-[18px]">
        <Link href="/dashboard" className="flex items-center gap-3" aria-label={t("डैशबोर्ड खोलें", "Open dashboard")}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated font-display text-xl font-bold text-count">
            {userName.slice(0, 1)}
          </span>
          <span>
            <span className="block font-display text-[22px] font-bold leading-[1.1]">
              {t("नमस्ते", "Hello")}, {userName}
            </span>
            <span className="block text-sm text-ink-dim">
              {longDate(date, lang)}
              {lang === "hi" && ` · ${weekdayEn(date)}`}
            </span>
          </span>
        </Link>
        <LangToggle />
      </header>

      <main className="flex flex-col gap-3.5 px-4 pb-4 pt-2">
        <Link href="/pickup" className="flex items-center gap-4 rounded-[22px] bg-pickup p-[18px] text-pickup-ink transition hover:brightness-110">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-pickup-ink text-pickup">
            <TruckIcon size={30} />
          </span>
          <span className="flex-1">
            <span className="block font-display text-[26px] font-extrabold leading-[1.05]">{t("नया माल आया", "New pickup")}</span>
            <span className="block text-[15px] font-semibold opacity-85">{t("New pickup from a party", "नया माल आया")}</span>
          </span>
          <PlusIcon size={30} />
        </Link>

        {stale > 0 && (
          <Link href="/count" className="flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-tint px-3.5 py-3 text-danger-note">
            <AlertIcon className="text-danger-icon" />
            <span className="flex-1 text-[15px] leading-[1.3]">
              {lang === "hi" ? (
                <>
                  <b className="font-bold">
                    {stale} बैग {STALE_COUNT_DAYS} दिन से पड़े हैं
                  </b>{" "}
                  — आज गिन लें
                  <br />
                  <span className="text-[13px] text-danger-mute">
                    {stale} bags waiting over {STALE_COUNT_DAYS} days
                  </span>
                </>
              ) : (
                <>
                  <b className="font-bold">
                    {stale} bags waiting over {STALE_COUNT_DAYS} days
                  </b>{" "}
                  — count them today
                  <br />
                  <span className="text-[13px] text-danger-mute">
                    {stale} बैग {STALE_COUNT_DAYS} दिन से पड़े हैं
                  </span>
                </>
              )}
            </span>
            <ChevronRightIcon size={20} />
          </Link>
        )}

        <div className="flex items-baseline justify-between px-1 pt-1">
          <h1 className="font-display text-[21px] font-bold">{t("आज का काम", "Today's work")}</h1>
          <span className="text-sm text-ink-faint">{t("Today's work", "आज का काम")}</span>
        </div>

        <StageCard
          href="/count"
          step={2}
          tone="count"
          icon={<ClipboardIcon size={28} />}
          title={t("गिनती बाकी है", "Bags to count")}
          detail={t("Bags to count", "गिनती बाकी है")}
          value={String(uncounted)}
          unit={t("बैग", "bags")}
        />
        <StageCard
          href="/piles"
          step={3}
          tone="pile"
          icon={<LayersIcon size={28} />}
          title={toTie > 0 ? t("ढेर भर गए, बैग बाँधो", "Piles full — tie bags") : t("ढेर", "Piles")}
          detail={toTie > 0 ? t("Piles full — tie up bags", "ढेर भर गए, बैग बाँधो") : t("कोई ढेर भरा नहीं", "No pile is full yet")}
          value={String(toTie)}
          unit={t("बैग", "bags")}
        />
        <StageCard
          href="/send"
          step={4}
          tone="factory"
          icon={<SendIcon size={28} />}
          title={t("फैक्ट्री भेजने को तैयार", "Ready for factory")}
          detail={`${t("Ready for factory", "फैक्ट्री भेजने को तैयार")} · ${lakh(sumValue(ready), lang)}`}
          value={String(ready.length)}
          unit={t("बैग", "bags")}
        />
        <StageCard
          href="/money"
          step={5}
          tone="money"
          icon={<RupeeIcon size={28} />}
          title={t("फैक्ट्री से पैसा आना है", "Due from factories")}
          detail={`${t("Due from factories", "फैक्ट्री से पैसा आना है")} · ${owed.length} ${t("runs", "गाड़ी")}`}
          value={owedAmount}
          unit={owedUnit}
          small
        />

        <Link href="/godown/new" className="flex items-center gap-3.5 rounded-[18px] border border-godown-line bg-godown-panel p-3.5 transition-colors hover:brightness-110">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-godown-tint text-godown">
            <WarehouseIcon size={28} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[19px] font-bold leading-[1.15]">{t("गोदाम में माल ख़राब हुआ?", "Damage in the godown?")}</span>
            <span className="block text-sm text-godown-mute">{t("Own stock damage · दर्ज करें", "Own stock · log it here")}</span>
          </span>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-godown text-godown-ink">
            <PlusIcon size={22} />
          </span>
        </Link>

        <div className="flex items-baseline justify-between px-1 pt-2">
          <h2 className="font-display text-[21px] font-bold">{t("और काम", "More")}</h2>
          <span className="text-sm text-ink-faint">{t("More", "और काम")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickTile href="/godown" icon={<WarehouseIcon size={22} />} tone="text-godown" title={t("गोदाम नुकसान", "Godown damage")} detail={toReview ? t(`${toReview} जाँच बाकी`, `${toReview} to review`) : t("सब निपटा", "All reviewed")} />
          <QuickTile href="/money" icon={<RupeeIcon size={22} />} tone="text-money" title={t("हिसाब", "Money")} detail={t("गाड़ी और पार्टी", "By run and party")} />
          <QuickTile href="/collections" icon={<TruckIcon size={22} />} tone="text-pickup" title={t("सारे बैग", "All bags")} detail={t("हर पिकअप", "Every pickup")} />
          <QuickTile href="/more" icon={<MenuIcon size={22} />} tone="text-ink-dim" title={t("और सब", "Everything else")} detail={t("पार्टी, सामान, सेटिंग", "Parties, items, settings")} />
        </div>
      </main>
    </div>
  );
}

/** "₹6.8" + "लाख", or the full amount when it is under a lakh. */
function lakhParts(value: number, lang: "hi" | "en"): [string, string] {
  if (value < 100_000) return [`₹${Math.round(value / 1000)}k`, lang === "hi" ? "हज़ार" : "thousand"];
  return [`₹${(value / 100_000).toFixed(1)}`, lang === "hi" ? "लाख" : "lakh"];
}

const TONES = {
  count: { tile: "bg-count-tint text-count", badge: "bg-count", value: "text-count" },
  pile: { tile: "bg-pile-tint text-pile", badge: "bg-pile", value: "text-pile" },
  factory: { tile: "bg-factory-tint text-factory", badge: "bg-factory", value: "text-factory" },
  money: { tile: "bg-money-tint text-money", badge: "bg-money", value: "text-money" },
};

function StageCard({
  href,
  step,
  tone,
  icon,
  title,
  detail,
  value,
  unit,
  small,
}: {
  href: string;
  step: number;
  tone: keyof typeof TONES;
  icon: ReactNode;
  title: string;
  detail: string;
  value: string;
  unit: string;
  small?: boolean;
}) {
  const c = TONES[tone];
  return (
    <Link href={href} className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-3.5 transition-colors hover:bg-elevated">
      <span className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${c.tile}`}>
        {icon}
        <span className={`absolute -left-1.5 -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[13px] font-extrabold text-night ${c.badge}`}>
          {step}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[19px] font-bold leading-[1.15]">{title}</span>
        <span className="block text-sm text-ink-dim">{detail}</span>
      </span>
      <span className="text-right">
        <span className={`block font-display font-extrabold ${small ? "text-[26px] leading-[1.1]" : "text-[32px] leading-none"} ${c.value}`}>{value}</span>
        <span className="block text-[13px] text-ink-dim">{unit}</span>
      </span>
    </Link>
  );
}

function QuickTile({ href, icon, tone, title, detail }: { href: string; icon: ReactNode; tone: string; title: string; detail: string }) {
  return (
    <Link href={href} className="flex min-h-[76px] items-center gap-3 rounded-[18px] border border-line bg-surface p-3 transition-colors hover:bg-elevated">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-elevated ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold leading-tight">{title}</span>
        <span className="block truncate text-[13px] text-ink-dim">{detail}</span>
      </span>
    </Link>
  );
}
