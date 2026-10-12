"use client";

import { BAG_CAPACITY } from "@/lib/bag-packing";
import { useLang } from "@/lib/i18n";
import { NEAR_FULL, STALE_CLAIM_DAYS, STALE_COUNT_DAYS, STALE_READY_DAYS } from "@/lib/pipeline";
import { AccountCard } from "@/components/account/account-card";
import { ThisDeviceCard } from "@/components/account/cloud-screens";
import { GearIcon } from "@/components/ft/icons";
import { ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { LangToggle } from "@/components/layout/lang-toggle";

/** Your account, language, and the rules the app works by. */
export function SettingsScreen() {
  const { t, sub } = useLang();

  const rules: [string, string, string][] = [
    [t("एक बैग में पीस", "Pieces per bag"), String(BAG_CAPACITY), t("इतने पीस होते ही बैग भर जाता है और नया नंबर वाला बैग खुलता है", "At this many pieces a bag is full and a new numbered bag opens")],
    [t("गिनती की चेतावनी", "Count warning"), t(`${STALE_COUNT_DAYS} दिन`, `${STALE_COUNT_DAYS} days`), t("इतने दिन से बिना गिने बैग लाल दिखते हैं", "Bags uncounted this long turn red")],
    [t("तैयार बैग की चेतावनी", "Ready-bag warning"), t(`${STALE_READY_DAYS} दिन`, `${STALE_READY_DAYS} days`), t("गोदाम में इतने दिन पड़े बैग याद दिलाए जाते हैं", "Tied bags waiting this long are flagged")],
    [t("क्लेम की चेतावनी", "Claim warning"), t(`${STALE_CLAIM_DAYS} दिन`, `${STALE_CLAIM_DAYS} days`), t("इतने दिन से पैसा न आए तो फ़ोन करने को कहा जाता है", "Unpaid runs this old say call the factory")],
    [t("लगभग भरा बैग", "Almost-full bag"), t(`${NEAR_FULL} पीस कम`, `${NEAR_FULL} short`), t("भर रहे बैग में इतने पीस कम हों तो वह पीला दिखता है", "Bags being filled this close to full show yellow")],
  ];

  return (
    <Screen>
      <ListHeader tone="neutral" icon={<GearIcon size={26} />} title={t("सेटिंग", "Settings")} subtitle={t("आपका खाता, भाषा और नियम", "Your account, language and rules")} />
      <ScreenBody className="gap-4">
        <AccountCard />
        <ThisDeviceCard />

        <section className="flex items-center justify-between gap-3 rounded-[20px] border border-line bg-surface p-4">
          <span>
            <span className="block text-[15px] font-bold">{t("भाषा", "Language")}</span>
            <span className="text-sm text-ink-dim">{t("कौन सी भाषा बड़ी दिखे", "Which language leads")}</span>
          </span>
          <LangToggle />
        </section>

        <section className="rounded-[20px] border border-line bg-surface p-4">
          <p className="text-[15px] font-bold">
            {t("काम के नियम", "Working rules")} <span className="font-medium text-ink-faint">· {sub("काम के नियम", "Working rules")}</span>
          </p>
          <div className="mt-2 flex flex-col divide-y divide-line">
            {rules.map(([label, value, detail]) => (
              <div key={label} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold">{label}</span>
                  <span className="block text-sm text-ink-dim">{detail}</span>
                </span>
                <b className="shrink-0 font-display text-xl">{value}</b>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-faint">{t("ये नियम अभी ऐप में तय हैं।", "These rules are fixed in the app for now.")}</p>
        </section>
      </ScreenBody>
    </Screen>
  );
}
