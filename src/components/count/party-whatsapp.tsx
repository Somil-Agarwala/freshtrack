"use client";

import Link from "next/link";
import { fullDate, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { partyBags } from "@/lib/party-message";
import { useStore } from "@/lib/store";
import { WhatsAppIcon } from "@/components/ft/icons";

/**
 * After counting (and on a pickup's page): this party's counted bags not
 * yet reported to them -- from every pickup, not just this one -- and the
 * way to send them ONE WhatsApp covering all of them.
 */
export function PartyWhatsApp({ collectionId }: { collectionId: string }) {
  const { t, lang } = useLang();
  const { collections, countLines, distributors } = useStore();
  const bag = collections.find((c) => c.id === collectionId);
  if (!bag) return null;

  const party = distributors.find((d) => d.id === bag.distributorId);
  const name = party?.name ?? t("पार्टी", "the party");
  const { unsent, uncounted } = partyBags(bag.distributorId, collections);
  const href = `/party-message?party=${bag.distributorId}`;

  if (unsent.length === 0) {
    return bag.partyNotified ? (
      <Link href={href} className="flex items-center gap-2.5 rounded-2xl bg-surface p-3.5 text-[15px] text-ink-dim">
        <WhatsAppIcon size={22} className="shrink-0 text-money" />
        <span className="flex-1">
          {t(`${name} को ${fullDate(bag.partyNotified, lang)} को भेजा गया`, `Reported to ${name} on ${fullDate(bag.partyNotified, lang)}`)}
        </span>
        <span className="text-sm font-bold">{t("फिर भेजें", "Send again")}</span>
      </Link>
    ) : null;
  }

  const ids = new Set(unsent.map((c) => c.id));
  const pieces = countLines.filter((l) => ids.has(l.collectionId)).reduce((s, l) => s + l.quantity, 0);

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-money-line bg-money-tint p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
          <WhatsAppIcon size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[17px] leading-tight text-money-note">
            {t(`${name}: ${unsent.length} बैग गिने, अभी बताया नहीं`, `${name}: ${unsent.length} bag${unsent.length > 1 ? "s" : ""} counted, not reported yet`)}
          </b>
          <span className="text-sm text-money-mute">
            {num(pieces)} {t("पीस", "pieces")}
            {uncounted.length > 0
              ? ` · ${t(`${uncounted.length} बैग गिनने बाकी — सब गिनकर एक साथ भेजें`, `${uncounted.length} still to count — count them, then send once`)}`
              : ` · ${t("सारे बैग गिन लिए", "all bags counted")}`}
          </span>
        </span>
      </div>
      <Link href={href} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] font-display text-lg font-extrabold text-[#06301A] hover:brightness-110">
        <WhatsAppIcon size={22} />
        {t(`${unsent.length} बैग का एक WhatsApp भेजें`, `One WhatsApp for ${unsent.length} bag${unsent.length > 1 ? "s" : ""}`)}
      </Link>
    </section>
  );
}
