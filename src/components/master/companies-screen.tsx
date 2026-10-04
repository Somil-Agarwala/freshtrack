"use client";

import { useState } from "react";
import { lakhShort } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { awaitingPayment, readyBags } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import type { Company } from "@/types";
import { CompanyAvatar } from "@/components/ft/brand";
import { BuildingIcon, PlusIcon } from "@/components/ft/icons";
import { Field, Pill, Toggle, inputClass } from "@/components/ft/kit";
import { BigButton, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

/** The brands you claim against; each settles at its own factory. */
export function CompaniesScreen() {
  const { t } = useLang();
  const { companies, collections, sortedBags, dispatches, saveCompany } = useStore();
  const [editing, setEditing] = useState<Company | null>(null);

  return (
    <Screen width="wide">
      <ListHeader tone="neutral" icon={<BuildingIcon size={26} />} title={t("कंपनियाँ", "Companies")} subtitle={t("हर कंपनी का क्लेम अलग, फैक्ट्री अलग", "Each one claims and settles separately")} />
      <ScreenBody className="gap-3">
        <button
          type="button"
          onClick={() => setEditing({ id: `co-${Date.now()}`, name: "", code: "", claimContact: "", isActive: true })}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-[17px] font-bold text-ink-dim hover:text-ink"
        >
          <PlusIcon size={22} />
          {t("नई कंपनी जोड़ें", "Add a company")}
        </button>
        <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
          {companies.map((c) => {
            const toCount = collections.filter((x) => x.companyId === c.id && x.status === "uncounted").length;
            const ready = readyBags(sortedBags, c.id).length;
            const owed = awaitingPayment(dispatches, c.id).reduce((s, d) => s + d.claimedValue, 0);
            return (
              <button key={c.id} type="button" onClick={() => setEditing(c)} className={`flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-3.5 text-left transition-colors hover:bg-elevated ${c.isActive ? "" : "opacity-60"}`}>
                <span className="flex w-full items-center gap-3">
                  <CompanyAvatar company={c} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-xl font-bold leading-tight">{c.name}</span>
                    <span className="block truncate text-sm text-ink-dim">
                      {c.code} · {c.claimContact || t("क्लेम का संपर्क नहीं", "no claim contact")}
                    </span>
                  </span>
                  {!c.isActive && <Pill tone="neutral">{t("बंद", "Inactive")}</Pill>}
                </span>
                <span className="grid w-full grid-cols-3 gap-2 text-sm">
                  <Stat label={t("गिनती बाकी", "To count")} value={String(toCount)} tone="text-count-soft" />
                  <Stat label={t("तैयार बैग", "Ready bags")} value={String(ready)} tone="text-factory-soft" />
                  <Stat label={t("फैक्ट्री के पास", "With factory")} value={lakhShort(owed, 1)} tone="text-pickup-soft" />
                </span>
              </button>
            );
          })}
        </div>
      </ScreenBody>
      {editing && (
        <CompanySheet
          key={editing.id}
          company={editing}
          isNew={!companies.some((c) => c.id === editing.id)}
          taken={companies.filter((c) => c.id !== editing.id).map((c) => c.code)}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            saveCompany(c);
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="rounded-xl bg-elevated px-2.5 py-2">
      <span className="block truncate text-[13px] text-ink-faint">{label}</span>
      <b className={`text-base ${tone}`}>{value}</b>
    </span>
  );
}

function CompanySheet({ company, isNew, taken, onClose, onSave }: { company: Company; isNew: boolean; taken: string[]; onClose: () => void; onSave: (c: Company) => void }) {
  const { t } = useLang();
  const [draft, setDraft] = useState(company);
  const code = draft.code.trim().toUpperCase();
  const clash = taken.includes(code);
  const valid = draft.name.trim() && /^[A-Z]{2,4}$/.test(code) && !clash;

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t("नई कंपनी", "New company") : company.name}
      footer={
        <BigButton tone="money" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim(), code, claimContact: draft.claimContact?.trim() })}>
          {t("सेव करें", "Save")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-4">
        <Field hi="नाम" en="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Cadbury" autoFocus={isNew} />
        </Field>
        <Field
          hi="छोटा कोड"
          en="Short code"
          hint={clash ? t("यह कोड पहले से है", "This code is already used") : isNew ? t("बैग नंबर इसी से शुरू होंगे, जैसे CAD-COL-2026-0001", "Bag numbers start with it, e.g. CAD-COL-2026-0001") : t("पुराने बैग नंबर नहीं बदलेंगे", "Existing bag numbers keep the old code")}
        >
          <input className={inputClass} value={draft.code} maxLength={4} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} placeholder="CAD" />
        </Field>
        <Field hi="क्लेम किससे करते हैं" en="Claim contact" optional>
          <input className={inputClass} value={draft.claimContact ?? ""} onChange={(e) => setDraft({ ...draft, claimContact: e.target.value })} placeholder="Regional Claims Desk" />
        </Field>
        <Toggle on={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} label={t("चालू है", "Active")} detail={t("बंद कंपनी पिकअप में नहीं दिखती", "Inactive companies are hidden from pickups")} />
      </div>
    </Dialog>
  );
}
