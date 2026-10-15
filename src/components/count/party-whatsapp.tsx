"use client";

import { useState } from "react";
import { shareOnWhatsApp, whatsAppNumber } from "@/lib/device";
import { fullDate, num } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import { partyDamageMessage, pickupBatch, receivedItems } from "@/lib/party-message";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CheckIcon, WhatsAppIcon } from "@/components/ft/icons";
import { Toggle, inputClass } from "@/components/ft/kit";
import { BigButton } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

/**
 * Once every bag of a party's pickup is counted: send the party a WhatsApp
 * message with what was received -- items and pieces only, no bag numbers
 * or anything internal. Until then, says how many bags are left to count.
 */
export function PartyWhatsApp({ collectionId }: { collectionId: string }) {
  const { t, lang } = useLang();
  const { collections, countLines, products, distributors } = useStore();
  const [open, setOpen] = useState(false);
  const bag = collections.find((c) => c.id === collectionId);
  if (!bag) return null;

  const batch = pickupBatch(bag, collections);
  const left = batch.filter((c) => c.status === "uncounted").length;
  const party = distributors.find((d) => d.id === bag.distributorId);
  const items = receivedItems(batch, countLines, products);
  const pieces = items.reduce((s, i) => s + i.pieces, 0);
  const sent = batch.find((c) => c.partyNotified)?.partyNotified;

  if (left > 0) {
    return (
      <p className="flex items-center gap-2.5 rounded-2xl bg-surface p-3.5 text-[15px] text-ink-dim">
        <WhatsAppIcon size={22} className="shrink-0 text-ink-faint" />
        {t(
          `इस पिकअप के ${left} और बैग गिनने बाकी हैं। सब गिनने पर ${party?.name ?? "पार्टी"} को WhatsApp भेज सकेंगे।`,
          `${left} more bag${left > 1 ? "s" : ""} of this pickup to count. Once all are counted you can WhatsApp ${party?.name ?? "the party"}.`
        )}
      </p>
    );
  }
  if (pieces === 0) return null;

  return (
    <>
      <section className="flex flex-col gap-3 rounded-[20px] border border-money-line bg-money-tint p-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <WhatsAppIcon size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[17px] leading-tight text-money-note">
              {batch.length === 1
                ? t(`${party?.name ?? "पार्टी"} का माल गिन लिया`, `${party?.name ?? "The party"}'s goods counted`)
                : t(`${party?.name ?? "पार्टी"} के सारे ${batch.length} बैग गिन लिए`, `All ${batch.length} bags from ${party?.name ?? "the party"} counted`)}
            </b>
            <span className="text-sm text-money-mute">
              {num(pieces)} {t("पीस", "pieces")} · {items.length} {t("तरह का सामान", items.length === 1 ? "item" : "items")}
              {sent && ` · ✓ ${t("भेजा", "sent")} ${fullDate(sent, lang)}`}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] font-display text-lg font-extrabold text-[#06301A] hover:brightness-110"
        >
          <WhatsAppIcon size={22} />
          {sent ? t("पार्टी को फिर से भेजें", "Send to the party again") : t("पार्टी को WhatsApp भेजें", "WhatsApp the party")}
        </button>
      </section>
      {open && (
        <SendSheet
          collectionIds={batch.map((c) => c.id)}
          partyId={bag.distributorId}
          companyId={bag.companyId}
          defaultLang={lang}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SendSheet({ collectionIds, partyId, companyId, defaultLang, onClose }: { collectionIds: string[]; partyId: string; companyId: string; defaultLang: Lang; onClose: () => void }) {
  const { t } = useLang();
  const { can } = useSession();
  const { collections, countLines, products, distributors, companies, saveDistributor, markPartyNotified } = useStore();
  const party = distributors.find((d) => d.id === partyId);
  const company = companies.find((c) => c.id === companyId);
  const batch = collections.filter((c) => collectionIds.includes(c.id));
  const items = receivedItems(batch, countLines, products);
  const [msgLang, setMsgLang] = useState<Lang>(defaultLang);
  const [withValue, setWithValue] = useState(false);
  const [phone, setPhone] = useState(party?.phone ?? "");
  const [editing, setEditing] = useState(!whatsAppNumber(party?.phone));

  const message = partyDamageMessage({ party, company, batch, items, lang: msgLang, withValue });
  const number = whatsAppNumber(phone);

  function send() {
    // A new number is remembered for this party, so next time it goes straight to them.
    if (party && number && number !== whatsAppNumber(party.phone) && can("addParty")) saveDistributor({ ...party, phone: phone.trim() });
    shareOnWhatsApp(message, number ?? undefined);
    markPartyNotified(collectionIds);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("पार्टी को WhatsApp", "WhatsApp the party")}
      description={party?.name}
      footer={
        <BigButton tone="money" onClick={send} className="bg-[#25D366] text-[#06301A]">
          <WhatsAppIcon />
          {t("WhatsApp खोलें", "Open WhatsApp")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label={t("संदेश की भाषा", "Message language")} className="flex gap-1 rounded-2xl bg-elevated p-1">
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
              {number
                ? t("यह नंबर इस पार्टी के लिए याद रखा जाएगा", "This number is remembered for the party")
                : t("नंबर न डालें तो WhatsApp में पार्टी चुननी होगी", "Without a number, pick the party in WhatsApp")}
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
      </div>
    </Dialog>
  );
}
