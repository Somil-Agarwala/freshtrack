"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { initials, lakhShort } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { partyAccounts } from "@/lib/pipeline";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Distributor } from "@/types";
import { partyTone } from "@/components/ft/brand";
import { ShopIcon, ChevronRightIcon, PhoneIcon, PlusIcon } from "@/components/ft/icons";
import { EmptyCard, Field, Pill, SearchBox, Toggle, inputClass } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

/** The parties you collect damaged stock from, with what each is owed. */
export function PartiesScreen({ initialSearch = "" }: { initialSearch?: string }) {
  const { t } = useLang();
  const { distributors, collections, dispatches, sortedBags, countLines, saveDistributor } = useStore();
  const [query, setQuery] = useState(initialSearch);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const { can } = useSession();
  const accounts = useMemo(() => partyAccounts(dispatches, sortedBags, collections, countLines), [dispatches, sortedBags, collections, countLines]);

  const q = query.trim().toLowerCase();
  const list = distributors
    .filter((d) => !q || [d.name, d.region, d.contactName].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  return (
    <Screen width="wide">
      <ListHeader tone="pickup" icon={<ShopIcon size={26} />} title={t("पार्टियाँ", "Parties")} subtitle={t("जिनसे डैमेज माल आता है", "Where damaged stock is collected from")} />
      <ScreenBody className="gap-3">
        <div className="flex gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t("नाम, इलाका या संपर्क…", "Name, area or contact…")} className="flex-1" />
          {can("addParty") && (
          <button
            type="button"
            onClick={() => setEditing({ id: `d-${Date.now()}`, name: query, contactName: "", phone: "", region: "", isActive: true })}
            className="flex h-[54px] shrink-0 items-center gap-1.5 rounded-2xl bg-pickup px-4 font-bold text-pickup-ink"
          >
            <PlusIcon size={20} />
            {t("नई", "New")}
          </button>
          )}
        </div>
        {list.length === 0 && <EmptyCard title={t("कोई पार्टी नहीं", "No parties")} />}
        <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
          {list.map((d) => {
            const tone = partyTone(d.name);
            const pickups = collections.filter((c) => c.distributorId === d.id);
            const account = accounts.find((a) => a.distributorId === d.id);
            const tel = d.phone.replace(/[^\d+]/g, "");
            return (
              <div key={d.id} className={cn("flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-3.5", !d.isActive && "opacity-60")}>
                <button type="button" disabled={!can("editMaster")} onClick={() => setEditing(d)} className="flex w-full items-center gap-3 text-left">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-display text-lg font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
                    {initials(d.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold leading-[1.2]">{d.name}</span>
                    <span className="block truncate text-sm text-ink-dim">
                      {[d.region, d.contactName].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  {!d.isActive && <Pill tone="neutral">{t("बंद", "Inactive")}</Pill>}
                </button>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-ink-dim">
                    {pickups.length} {t("पिकअप", "pickups")}
                    {account ? (
                      <>
                        {" · "}
                        {account.pending > 0 ? <b className="text-factory">{lakhShort(account.pending, 1)} {t("बाकी", "pending")}</b> : <b className="text-money">{t("सब मिला", "all paid")}</b>}
                      </>
                    ) : null}
                  </span>
                  {account && (
                    <Link href={`/money?view=parties&party=${d.id}`} className="flex h-10 items-center gap-1 rounded-xl bg-elevated px-3 font-bold text-money">
                      {t("हिसाब", "Account")}
                      <ChevronRightIcon size={14} />
                    </Link>
                  )}
                  {tel.length >= 10 && !tel.includes("X") && (
                    <a href={`tel:${tel}`} aria-label={t(`${d.contactName} को फ़ोन करें`, `Call ${d.contactName}`)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-pickup text-pickup-ink">
                      <PhoneIcon size={18} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScreenBody>
      {editing && (
        <PartySheet
          key={editing.id}
          party={editing}
          isNew={!distributors.some((d) => d.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            saveDistributor(d);
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}

function PartySheet({ party, isNew, onClose, onSave }: { party: Distributor; isNew: boolean; onClose: () => void; onSave: (d: Distributor) => void }) {
  const { t } = useLang();
  const [draft, setDraft] = useState(party);
  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t("नई पार्टी", "New party") : party.name}
      footer={
        <BigButton tone="pickup" disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim(), contactName: draft.contactName.trim(), phone: draft.phone.trim(), region: draft.region.trim() })}>
          {t("सेव करें", "Save")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-4">
        <Field hi="पार्टी का नाम" en="Party name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus={isNew} />
        </Field>
        <Field hi="किससे बात होती है" en="Contact person" optional>
          <input className={inputClass} value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} />
        </Field>
        <Field hi="फ़ोन" en="Phone" optional>
          <input className={inputClass} inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+91 98xxx xxxxx" />
        </Field>
        <Field hi="शहर / इलाका" en="Town / area" optional>
          <input className={inputClass} value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
        </Field>
        <Toggle on={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} label={t("चालू है", "Active")} detail={t("बंद पार्टी पिकअप में नहीं दिखती", "Inactive parties are hidden from pickups")} />
      </div>
    </Dialog>
  );
}
