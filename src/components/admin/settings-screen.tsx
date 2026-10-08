"use client";

import { useState } from "react";
import { BAG_CAPACITY } from "@/lib/bag-packing";
import { useFlash } from "@/lib/device";
import { useLang } from "@/lib/i18n";
import { NEAR_FULL, STALE_CLAIM_DAYS, STALE_COUNT_DAYS, STALE_READY_DAYS } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { AccountCard } from "@/components/account/account-card";
import { GearIcon } from "@/components/ft/icons";
import { Field, inputClass } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { LangToggle } from "@/components/layout/lang-toggle";
import { Notice } from "@/components/ui/notice";

/** Your account, language, and the rules the app works by. */
export function SettingsScreen() {
  const { t, sub } = useLang();
  const { user } = useSession();
  const { saveUser } = useStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [message, flash] = useFlash();

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  const pinError =
    current.length === 4 && current !== user?.pin
      ? t("पुराना PIN गलत है", "Current PIN is wrong")
      : again.length === 4 && again !== next
        ? t("दोनों नए PIN अलग हैं", "The new PINs do not match")
        : null;
  const pinReady = user && current === user.pin && next.length === 4 && next === again && next !== current;

  const rules: [string, string, string][] = [
    [t("एक बैग में पीस", "Pieces per bag"), String(BAG_CAPACITY), t("ढेर इतने पीस पर बैग बनता है", "A pile becomes a bag at this many pieces")],
    [t("गिनती की चेतावनी", "Count warning"), t(`${STALE_COUNT_DAYS} दिन`, `${STALE_COUNT_DAYS} days`), t("इतने दिन से बिना गिने बैग लाल दिखते हैं", "Bags uncounted this long turn red")],
    [t("तैयार बैग की चेतावनी", "Ready-bag warning"), t(`${STALE_READY_DAYS} दिन`, `${STALE_READY_DAYS} days`), t("गोदाम में इतने दिन पड़े बैग याद दिलाए जाते हैं", "Tied bags waiting this long are flagged")],
    [t("क्लेम की चेतावनी", "Claim warning"), t(`${STALE_CLAIM_DAYS} दिन`, `${STALE_CLAIM_DAYS} days`), t("इतने दिन से पैसा न आए तो फ़ोन करने को कहा जाता है", "Unpaid runs this old say call the factory")],
    [t("लगभग भरा ढेर", "Almost-full pile"), t(`${NEAR_FULL} पीस कम`, `${NEAR_FULL} short`), t("इतने पीस कम हों तो ढेर पीला दिखता है", "Piles this close to a bag show yellow")],
  ];

  return (
    <Screen>
      <ListHeader tone="neutral" icon={<GearIcon size={26} />} title={t("सेटिंग", "Settings")} subtitle={t("आपका खाता, भाषा और नियम", "Your account, language and rules")} />
      <ScreenBody className="gap-4">
        <AccountCard />

        <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
          <p className="text-[15px] font-bold">
            {t("अपना PIN बदलें", "Change your PIN")} <span className="font-medium text-ink-faint">· {sub("अपना PIN बदलें", "Change your PIN")}</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Field hi="पुराना" en="Current">
              <input className={inputClass} type="password" inputMode="numeric" value={current} onChange={(e) => setCurrent(digits(e.target.value))} />
            </Field>
            <Field hi="नया" en="New">
              <input className={inputClass} type="password" inputMode="numeric" value={next} onChange={(e) => setNext(digits(e.target.value))} />
            </Field>
            <Field hi="फिर से" en="Again">
              <input className={inputClass} type="password" inputMode="numeric" value={again} onChange={(e) => setAgain(digits(e.target.value))} />
            </Field>
          </div>
          {pinError && <p className="text-[15px] font-bold text-danger-soft">{pinError}</p>}
          <BigButton
            tone="money"
            className="h-14 text-lg"
            disabled={!pinReady}
            onClick={() => {
              if (!user || !pinReady) return;
              saveUser({ ...user, pin: next });
              setCurrent("");
              setNext("");
              setAgain("");
              flash(t("नया PIN सेव हुआ", "New PIN saved"));
            }}
          >
            {t("PIN सेव करें", "Save PIN")}
          </BigButton>
        </section>

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
          <p className="mt-2 text-sm text-ink-faint">{t("ये नियम डेटाबेस जुड़ने के बाद यहीं से बदले जा सकेंगे।", "These become editable here once the database is connected.")}</p>
        </section>

        <p className="rounded-2xl bg-count-tint p-3.5 text-[15px] text-count-note">
          {t("अभी डेटाबेस नहीं जुड़ा है, इसलिए पेज रीलोड करने पर सिर्फ़ शुरू की सूची (कंपनी, सामान, पार्टी) बचती है — दर्ज किया काम मिट जाता है।", "The database is not connected yet: a reload keeps only the starting lists (companies, products, parties) and clears entered work.")}
        </p>
      </ScreenBody>
      <Notice message={message} />
    </Screen>
  );
}
