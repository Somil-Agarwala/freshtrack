"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { shareOnWhatsApp, whatsAppNumber } from "@/lib/device";
import { fullDate, initials, num } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import { partiesToMessage, partyBags, partyDamageMessage, receivedItems } from "@/lib/party-message";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CollectionBag, Distributor } from "@/types";
import { CompanyAvatar, partyTone } from "@/components/ft/brand";
import { CheckIcon, ChevronRightIcon, SearchIcon, WhatsAppIcon } from "@/components/ft/icons";
import { Toggle, inputClass } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";

/**
 * One WhatsApp message per party covering every bag of theirs that has been
 * counted and not yet reported -- six bags, one message, items added up.
 */
export function PartyMessageScreen() {
  const params = useSearchParams();
  const { distributors } = useStore();
  const party = distributors.find((d) => d.id === params.get("party"));
  if (party) return <Compose key={party.id} party={party} />;
  return <PickParty />;
}

/* ------------------------------------------------------------------ */

function PickParty() {
  const router = useRouter();
  const { t } = useLang();
  const { distributors, collections } = useStore();
  const [query, setQuery] = useState("");
  const waiting = useMemo(() => new Map(partiesToMessage(collections).map((p) => [p.partyId, p.bags])), [collections]);
  const q = query.trim().toLowerCase();
  const list = distributors
    .filter((d) => d.isActive || waiting.has(d.id))
    .filter((d) => !q || d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q))
    .sort((a, b) => (waiting.get(b.id) ?? 0) - (waiting.get(a.id) ?? 0) || a.name.localeCompare(b.name));

  return (
    <Screen>
      <ListHeader
        tone="money"
        back="/"
        icon={<WhatsAppIcon size={26} />}
        title={t("पार्टी को माल की जानकारी", "Tell a party what came in")}
        subtitle={t("गिने हुए सारे बैग का एक WhatsApp", "One WhatsApp for all their counted bags")}
      />
      <ScreenBody className="gap-3 pt-1">
        <label className="flex h-14 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-money">
          <SearchIcon size={22} className="text-ink-faint" />
          <input
            aria-label={t("पार्टी खोजें", "Search party")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("पार्टी का नाम लिखें…", "Type a party name…")}
            className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
        {waiting.size === 0 && !q && <p className="rounded-2xl bg-surface p-3.5 text-[15px] text-ink-dim">{t("सबको भेजा जा चुका है — कोई गिना बैग बाकी नहीं", "Everyone is up to date — no counted bags waiting")}</p>}
        <div className="flex flex-col gap-2">
          {list.map((party) => {
            const tone = partyTone(party.name);
            const n = waiting.get(party.id) ?? 0;
            return (
              <button
                key={party.id}
                type="button"
                onClick={() => router.push(`/party-message?party=${party.id}`)}
                className={cn("flex items-center gap-3 rounded-2xl border bg-surface p-3 text-left transition-colors hover:bg-elevated", n ? "border-money-line" : "border-line")}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-display text-lg font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
                  {initials(party.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold leading-[1.2]">{party.name}</span>
                  <span className={cn("block truncate text-sm", n ? "font-bold text-money" : "text-ink-dim")}>
                    {n ? t(`${n} गिने बैग — भेजना बाकी`, `${n} counted bag${n > 1 ? "s" : ""} to report`) : party.region || "—"}
                  </span>
                </span>
                <ChevronRightIcon size={22} className="text-ink-faint" />
              </button>
            );
          })}
        </div>
      </ScreenBody>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Compose({ party }: { party: Distributor }) {
  const { t, lang } = useLang();
  const { can } = useSession();
  const { collections, countLines, products, companies, saveDistributor, markPartyNotified } = useStore();
  const { unsent, sent, uncounted } = useMemo(() => partyBags(party.id, collections), [party.id, collections]);

  // Every counted bag not yet reported is ticked; earlier ones can be added.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(unsent.map((c) => c.id)));
  const [showSent, setShowSent] = useState(false);
  const [msgLang, setMsgLang] = useState<Lang>(lang);
  const [withValue, setWithValue] = useState(false);
  const [phone, setPhone] = useState(party.phone ?? "");
  const [editing, setEditing] = useState(!whatsAppNumber(party.phone));
  const [done, setDone] = useState<number | null>(null);

  const bags = [...unsent, ...sent].filter((c) => picked.has(c.id));
  const items = receivedItems(bags, countLines, products);
  const pieces = items.reduce((s, i) => s + i.pieces, 0);
  const message = partyDamageMessage({ party, companies, bags, items, lang: msgLang, withValue });
  const number = whatsAppNumber(phone);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function send() {
    // A new number is remembered for the party, so next time it goes straight to them.
    if (number && number !== whatsAppNumber(party.phone) && can("addParty")) saveDistributor({ ...party, phone: phone.trim() });
    shareOnWhatsApp(message, number ?? undefined);
    markPartyNotified(bags.map((c) => c.id));
    setDone(bags.length);
    setPicked(new Set());
  }

  const piecesOf = (c: CollectionBag) => countLines.filter((l) => l.collectionId === c.id).reduce((s, l) => s + l.quantity, 0);
  const row = (c: CollectionBag) => {
    const on = picked.has(c.id);
    const company = companies.find((x) => x.id === c.companyId);
    return (
      <li key={c.id}>
        <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(c.id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2", on ? "border-money bg-money text-money-ink" : "border-line-strong")}>{on && <CheckIcon size={16} />}</span>
          <CompanyAvatar company={company} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold">
              {fullDate(c.collectedDate, lang)} · {num(piecesOf(c))} {t("पीस", "pcs")}
            </span>
            <span className="block truncate text-[13px] text-ink-faint">
              {c.direct ? t("सीधी एंट्री", "Direct entry") : c.bagNumber}
              {c.partyNotified && ` · ✓ ${t("भेजा", "sent")} ${fullDate(c.partyNotified, lang)}`}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <Screen>
      <TaskHeader back="/party-message" tone="money" kicker={t("पार्टी को WhatsApp", "WhatsApp the party")}>
        <p className="truncate font-display text-[22px] font-extrabold leading-tight">{party.name}</p>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        {done !== null && (
          <p className="flex items-center gap-2 rounded-2xl bg-money-tint p-3.5 text-[15px] font-bold text-money-note">
            <CheckIcon size={20} className="shrink-0 text-money" />
            {t(`${done} बैग की जानकारी WhatsApp में खुल गई — वहाँ भेज दें`, `${done} bag${done === 1 ? "" : "s"} opened in WhatsApp — send it there`)}
          </p>
        )}
        {uncounted.length > 0 && (
          <Link href="/count" className="flex items-center gap-2.5 rounded-2xl border border-count/40 bg-count-tint p-3.5 text-[15px] text-count-note">
            <span className="flex-1">
              <b>{t(`इस पार्टी के ${uncounted.length} बैग अभी गिने नहीं`, `${uncounted.length} bag${uncounted.length > 1 ? "s" : ""} from this party not counted yet`)}</b>
              <br />
              {t("पहले गिन लें तो वे भी इसी एक संदेश में आ जाएँगे", "Count them first and they join this same message")}
            </span>
            <ChevronRightIcon size={20} className="shrink-0" />
          </Link>
        )}

        <div className="flex items-baseline justify-between px-0.5">
          <p className="font-display text-[20px] font-extrabold">{t("किन बैगों का माल", "Which bags")}</p>
          <span className="text-sm font-bold text-ink-dim">
            {bags.length} {t("बैग", "bags")} · {num(pieces)} {t("पीस", "pcs")}
          </span>
        </div>
        {unsent.length === 0 && !showSent && <p className="rounded-2xl bg-surface p-3.5 text-[15px] text-ink-dim">{t("इस पार्टी का कोई गिना बैग भेजना बाकी नहीं", "No counted bags from this party left to report")}</p>}
        {unsent.length > 0 && <ul className="flex flex-col divide-y divide-line rounded-[18px] border border-line bg-surface">{unsent.map(row)}</ul>}
        {sent.length > 0 && (
          <>
            <button type="button" onClick={() => setShowSent((v) => !v)} className="self-start text-[15px] font-bold text-ink-dim">
              {showSent ? t("पहले भेजे बैग छुपाएँ", "Hide bags already reported") : t(`पहले भेजे ${sent.length} बैग भी दिखाएँ`, `Show ${sent.length} bag${sent.length > 1 ? "s" : ""} already reported`)}
            </button>
            {showSent && <ul className="flex flex-col divide-y divide-line rounded-[18px] border border-line bg-surface opacity-90">{sent.map(row)}</ul>}
          </>
        )}

        {bags.length > 0 && (
          <>
            <div role="radiogroup" aria-label={t("संदेश की भाषा", "Message language")} className="mt-1 flex gap-1 rounded-2xl bg-elevated p-1">
              {(["hi", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={msgLang === l}
                  onClick={() => setMsgLang(l)}
                  className={cn("h-11 flex-1 rounded-xl text-base", msgLang === l ? "bg-surface font-bold shadow" : "font-semibold text-ink-dim")}
                >
                  {l === "hi" ? "हिंदी में" : "In English"}
                </button>
              ))}
            </div>
            <p className="whitespace-pre-wrap rounded-2xl border border-line bg-canvas p-3.5 text-[15px] leading-relaxed">{message}</p>
            <p className="-mt-1 text-sm text-ink-faint">{t("बैग नंबर या अंदर की कोई जानकारी नहीं जाती। WhatsApp में भेजने से पहले बदल भी सकते हैं।", "No bag numbers or internal details are sent. You can still edit it in WhatsApp before sending.")}</p>
            <Toggle on={withValue} onChange={setWithValue} label={t("MRP से ₹ भी लिखें", "Also show ₹ at MRP")} detail={t("हर सामान और कुल का MRP मूल्य", "MRP value per item and in total")} />
            {editing ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[15px] font-bold">
                  {t("पार्टी का WhatsApp नंबर", "Party's WhatsApp number")} <span className="font-medium text-ink-faint">({t("ज़रूरी नहीं", "optional")})</span>
                </span>
                <input className={inputClass} type="tel" inputMode="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <span className="text-sm text-ink-dim">
                  {number ? t("यह नंबर इस पार्टी के लिए याद रखा जाएगा", "This number is remembered for the party") : t("नंबर न डालें तो WhatsApp में पार्टी चुननी होगी", "Without a number, pick the party in WhatsApp")}
                </span>
              </label>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl bg-surface px-3.5 py-3 text-[15px]">
                <CheckIcon size={18} className="shrink-0 text-money" />
                <span className="flex-1">
                  {t("सीधे भेजेंगे", "Goes straight to")} <b>+{number}</b>
                </span>
                <button type="button" onClick={() => setEditing(true)} className="text-sm font-bold text-ink-dim">
                  {t("बदलें", "Change")}
                </button>
              </div>
            )}
          </>
        )}
      </ScreenBody>

      <ScreenFooter>
        <BigButton tone="money" onClick={send} disabled={bags.length === 0 || pieces === 0} className="bg-[#25D366] text-[#06301A]">
          <WhatsAppIcon />
          {t(`WhatsApp खोलें · ${bags.length} बैग`, `Open WhatsApp · ${bags.length} bag${bags.length === 1 ? "" : "s"}`)}
        </BigButton>
      </ScreenFooter>
    </Screen>
  );
}
