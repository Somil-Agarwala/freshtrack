"use client";

import { useState } from "react";
import { BAG_CAPACITY } from "@/lib/bag-packing";
import { useFlash } from "@/lib/device";
import { useLang } from "@/lib/i18n";
import { NEAR_FULL, STALE_CLAIM_DAYS, STALE_COUNT_DAYS, STALE_READY_DAYS } from "@/lib/pipeline";
import { useSettings } from "@/lib/settings";
import { GearIcon } from "@/components/ft/icons";
import { Field, inputClass } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { LangToggle } from "@/components/layout/lang-toggle";
import { Notice } from "@/components/ui/notice";

/** Your name and language, and the rules the app works by. */
export function SettingsScreen() {
  const { t, sub } = useLang();
  const { userName, setUserName } = useSettings();
  const [name, setName] = useState(userName);
  const [message, flash] = useFlash();

  const rules: [string, string, string][] = [
    [t("एक बैग में पीस", "Pieces per bag"), String(BAG_CAPACITY), t("ढेर इतने पीस पर बैग बनता है", "A pile becomes a bag at this many pieces")],
    [t("गिनती की चेतावनी", "Count warning"), t(`${STALE_COUNT_DAYS} दिन`, `${STALE_COUNT_DAYS} days`), t("इतने दिन से बिना गिने बैग लाल दिखते हैं", "Bags uncounted this long turn red")],
    [t("तैयार बैग की चेतावनी", "Ready-bag warning"), t(`${STALE_READY_DAYS} दिन`, `${STALE_READY_DAYS} days`), t("गोदाम में इतने दिन पड़े बैग याद दिलाए जाते हैं", "Tied bags waiting this long are flagged")],
    [t("क्लेम की चेतावनी", "Claim warning"), t(`${STALE_CLAIM_DAYS} दिन`, `${STALE_CLAIM_DAYS} days`), t("इतने दिन से पैसा न आए तो फ़ोन करने को कहा जाता है", "Unpaid runs this old say call the factory")],
    [t("लगभग भरा ढेर", "Almost-full pile"), t(`${NEAR_FULL} पीस कम`, `${NEAR_FULL} short`), t("इतने पीस कम हों तो ढेर पीला दिखता है", "Piles this close to a bag show yellow")],
  ];

  return (
    <Screen>
      <ListHeader tone="neutral" icon={<GearIcon size={26} />} title={t("सेटिंग", "Settings")} subtitle={t("आपका नाम, भाषा और नियम", "Your name, language and rules")} />
      <ScreenBody className="gap-4">
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4">
          <Field hi="आपका नाम" en="Your name" hint={t("घर और डैशबोर्ड पर नमस्ते इसी नाम से", "Used in the greeting on home and the dashboard")}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <BigButton
            tone="money"
            className="h-14 text-lg"
            disabled={!name.trim() || name.trim() === userName}
            onClick={() => {
              setUserName(name);
              flash(t("नाम सेव हुआ", "Name saved"));
            }}
          >
            {t("नाम सेव करें", "Save name")}
          </BigButton>
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-[15px] font-bold">{t("भाषा", "Language")}</span>
              <span className="text-sm text-ink-dim">{t("कौन सी भाषा बड़ी दिखे", "Which language leads")}</span>
            </span>
            <LangToggle />
          </div>
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
          <p className="mt-2 text-sm text-ink-faint">{t("ये नियम डेटाबेस जुड़ने के बाद यहीं से बदले जा सकेंगे।", "These become editable here once the database is connected.")}</p>
        </section>

        <p className="rounded-2xl bg-count-tint p-3.5 text-[15px] text-count-note">
          {t("अभी डेटाबेस नहीं जुड़ा है, इसलिए पेज रीलोड करने पर नमूना डेटा वापस आ जाता है।", "The database is not connected yet, so reloading the page brings back the sample data.")}
        </p>
      </ScreenBody>
      <Notice message={message} />
    </Screen>
  );
}
