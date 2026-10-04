"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFlash, useVoiceInput } from "@/lib/device";
import { initials } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { CompanyAvatar, partyTone } from "@/components/ft/brand";
import { ChevronRightIcon, MicIcon, PlusIcon, SearchIcon } from "@/components/ft/icons";
import { BigButton, Question, Screen, ScreenBody, StepHeader } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { usePickupParams } from "./use-pickup-params";

/** Pickup step 2: which party did it come from? */
export function PickupParty() {
  const router = useRouter();
  const { t, sub, lang } = useLang();
  const { distributors, collections, addDistributor } = useStore();
  const { company } = usePickupParams();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, flash] = useFlash();
  const voice = useVoiceInput(setQuery, lang);

  // Parties this company was last collected from come first.
  const parties = useMemo(() => {
    const last = new Map<string, string>();
    collections
      .filter((c) => c.companyId === company?.id)
      .forEach((c) => {
        if ((last.get(c.distributorId) ?? "") < c.collectedDate) last.set(c.distributorId, c.collectedDate);
      });
    const q = query.trim().toLowerCase();
    return distributors
      .filter((d) => d.isActive)
      .filter((d) => !q || [d.name, d.region, d.contactName].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => (last.get(b.id) ?? "").localeCompare(last.get(a.id) ?? "") || a.name.localeCompare(b.name));
  }, [distributors, collections, company, query]);

  if (!company) return <MissingStep />;
  const next = (partyId: string) => `/pickup/bags?company=${company.id}&party=${partyId}`;

  return (
    <Screen>
      <StepHeader back={`/pickup?company=${company.id}`} step={2} total={3} tone="pickup" hi="नया माल" en="New pickup" />
      <ScreenBody className="pt-3.5">
        <Link href={`/pickup?company=${company.id}`} className="flex items-center gap-2 self-start rounded-full bg-elevated py-1.5 pl-1.5 pr-3.5 text-[15px] font-semibold">
          <CompanyAvatar company={company} size={32} />
          {company.name} <span className="text-sm text-pickup">· {t("बदलें", "Change")}</span>
        </Link>

        <Question hi="किस पार्टी से लाए?" en="Which party did you collect from?" />

        <div className="flex gap-2">
          <label className="flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-pickup">
            <SearchIcon size={22} className="text-ink-faint" />
            <input
              aria-label={t("पार्टी खोजें", "Search party")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("नाम लिखें या बोलें…", "Type or say a name…")}
              className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <button
            type="button"
            aria-label={t("बोलकर खोजें", "Search by voice")}
            onClick={() => voice.start() || flash(t("इस फ़ोन पर बोलकर खोज नहीं चलती", "Voice search is not available on this phone"))}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-pickup text-pickup-ink ${voice.listening ? "animate-pulse" : ""}`}
          >
            <MicIcon />
          </button>
        </div>

        <p className="-mb-1 mx-0.5 mt-1 text-sm font-bold text-ink-faint">
          {query ? t("मिली पार्टियाँ", "Matching parties") : t("हाल की पार्टियाँ", "Recent")} · {query ? sub("मिली पार्टियाँ", "Matching") : sub("हाल की पार्टियाँ", "Recent")}
        </p>

        <div className="flex flex-col gap-2">
          {parties.map((party) => {
            const tone = partyTone(party.name);
            return (
              <Link key={party.id} href={next(party.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:bg-elevated">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-display text-lg font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
                  {initials(party.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold leading-[1.2]">{party.name}</span>
                  <span className="block truncate text-sm text-ink-dim">
                    {party.region} · {party.contactName}
                  </span>
                </span>
                <ChevronRightIcon size={22} className="text-ink-faint" />
              </Link>
            );
          })}
          {parties.length === 0 && <p className="rounded-2xl bg-surface p-4 text-center text-ink-dim">{t("इस नाम की कोई पार्टी नहीं", "No party with that name")}</p>}
        </div>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-[17px] font-bold text-ink-dim hover:text-ink"
        >
          <PlusIcon size={22} />
          {t("नई पार्टी जोड़ें", "Add new party")} · {sub("नई पार्टी जोड़ें", "Add new party")}
        </button>
      </ScreenBody>

      <NewPartySheet
        key={adding ? "open" : "closed"}
        open={adding}
        initialName={query}
        onClose={() => setAdding(false)}
        onSave={(input) => {
          const party = addDistributor(input);
          setAdding(false);
          router.push(next(party.id));
        }}
      />
      <Notice message={message} />
    </Screen>
  );
}

const field =
  "h-14 w-full rounded-2xl border border-line bg-canvas px-4 text-[17px] text-ink outline-none placeholder:text-ink-faint focus:border-pickup";

function NewPartySheet({
  open,
  initialName,
  onClose,
  onSave,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (input: { name: string; contactName: string; phone: string; region: string }) => void;
}) {
  const { t } = useLang();
  // Remounted on every open (see key above), starting from whatever was
  // typed into the search box.
  const [name, setName] = useState(initialName);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("नई पार्टी", "New party")}
      footer={
        <BigButton tone="pickup" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), contactName: contactName.trim(), phone: phone.trim(), region: region.trim() })}>
          {t("पार्टी जोड़ें", "Add party")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-3">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("पार्टी का नाम", "Party name")} autoFocus />
        <input className={field} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t("किससे बात होती है", "Contact person")} />
        <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("फ़ोन नंबर", "Phone")} inputMode="tel" />
        <input className={field} value={region} onChange={(e) => setRegion(e.target.value)} placeholder={t("शहर / इलाका", "Town / area")} />
      </div>
    </Dialog>
  );
}

export function MissingStep() {
  const { t } = useLang();
  return (
    <Screen>
      <ScreenBody className="items-center justify-center text-center">
        <p className="text-lg text-ink-dim">{t("पहले कंपनी चुनें", "Pick a company first")}</p>
        <Link href="/pickup" className="font-bold text-pickup">
          {t("नया माल शुरू करें", "Start a new pickup")}
        </Link>
      </ScreenBody>
    </Screen>
  );
}
