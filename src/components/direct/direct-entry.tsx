"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { claimRateOf } from "@/lib/claim";
import { inr, initials, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn, today } from "@/lib/utils";
import type { Company, Distributor, Product } from "@/types";
import { CompanyAvatar, MrpChip, partyTone } from "@/components/ft/brand";
import { ChevronRightIcon, ClipboardIcon, PlusIcon, SearchIcon } from "@/components/ft/icons";
import { BigButton, CompanyTabs, ListHeader, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";
import { NewItemSheet } from "@/components/count/count-screen";
import { NewPartySheet } from "@/components/pickup/pickup-party";

/**
 * "Add counted goods": for goods a party sent that are already counted (a
 * count sheet in hand), with no separate pickup step. Pick the company and
 * party, type how many of each item, and the pieces go straight into the
 * numbered bags -- the next screen says which bag gets what, as after a
 * normal count. The normal pickup → count flow is unchanged.
 */
export function DirectEntry() {
  const params = useSearchParams();
  const { companies, distributors } = useStore();
  const company = companies.find((c) => c.id === params.get("company"));
  const party = distributors.find((d) => d.id === params.get("party"));
  if (company && party) return <EntrySheet key={`${company.id}:${party.id}`} company={company} party={party} />;
  return <PickParty initialCompany={company?.id} />;
}

/* ------------------------------------------------------------------ */
/* Step 1: company and party                                            */
/* ------------------------------------------------------------------ */

function PickParty({ initialCompany }: { initialCompany?: string }) {
  const router = useRouter();
  const { t, sub } = useLang();
  const { can } = useSession();
  const { companies, distributors, collections, addDistributor } = useStore();
  const active = companies.filter((c) => c.isActive);
  const [companyId, setCompanyId] = useState(initialCompany ?? active.find((c) => c.code === "HLD")?.id ?? active[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  // Parties this company's goods last came from come first.
  const parties = useMemo(() => {
    const last = new Map<string, string>();
    collections
      .filter((c) => c.companyId === companyId)
      .forEach((c) => {
        if ((last.get(c.distributorId) ?? "") < c.collectedDate) last.set(c.distributorId, c.collectedDate);
      });
    const q = query.trim().toLowerCase();
    return distributors
      .filter((d) => d.isActive)
      .filter((d) => !q || [d.name, d.region, d.contactName].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => (last.get(b.id) ?? "").localeCompare(last.get(a.id) ?? "") || a.name.localeCompare(b.name));
  }, [distributors, collections, companyId, query]);

  const open = (partyId: string) => router.push(`/direct?company=${companyId}&party=${partyId}`);

  return (
    <Screen>
      <ListHeader
        tone="count"
        back="/"
        icon={<ClipboardIcon size={26} />}
        title={t("गिना हुआ माल डालें", "Add counted goods")}
        subtitle={t("पिकअप दर्ज किए बिना — सीधे नंबर वाले बैग में", "No pickup step — straight into numbered bags")}
      >
        <CompanyTabs companies={active} value={companyId} onChange={setCompanyId} tone="count" />
      </ListHeader>

      <ScreenBody className="gap-3 pt-1">
        <p className="mx-0.5 font-display text-[22px] font-extrabold leading-tight">
          {t("किस पार्टी का माल है?", "Whose goods are these?")} <span className="font-sans text-sm font-medium text-ink-faint">· {sub("किस पार्टी का माल है?", "Which party?")}</span>
        </p>
        <label className="flex h-14 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-count">
          <SearchIcon size={22} className="text-ink-faint" />
          <input
            aria-label={t("पार्टी खोजें", "Search party")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("पार्टी का नाम लिखें…", "Type a party name…")}
            className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-faint"
          />
        </label>

        <div className="flex flex-col gap-2">
          {parties.map((party) => {
            const tone = partyTone(party.name);
            return (
              <button key={party.id} type="button" onClick={() => open(party.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:bg-elevated">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-display text-lg font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
                  {initials(party.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold leading-[1.2]">{party.name}</span>
                  {party.region && <span className="block truncate text-sm text-ink-dim">{party.region}</span>}
                </span>
                <ChevronRightIcon size={22} className="text-ink-faint" />
              </button>
            );
          })}
          {parties.length === 0 && <p className="rounded-2xl bg-surface p-4 text-center text-ink-dim">{t("इस नाम की कोई पार्टी नहीं", "No party with that name")}</p>}
        </div>

        {can("addParty") && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-[17px] font-bold text-ink-dim hover:text-ink"
          >
            <PlusIcon size={22} />
            {t("नई पार्टी जोड़ें", "Add new party")}
          </button>
        )}
      </ScreenBody>

      <NewPartySheet
        key={adding ? "open" : "closed"}
        open={adding}
        initialName={query}
        onClose={() => setAdding(false)}
        onSave={(input) => {
          const party = addDistributor(input);
          setAdding(false);
          open(party.id);
        }}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: how many of each item                                        */
/* ------------------------------------------------------------------ */

const draftKey = (companyId: string, partyId: string) => `freshtrack.direct.${companyId}.${partyId}`;

function readDraft(key: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function EntrySheet({ company, party }: { company: Company; party: Distributor }) {
  const router = useRouter();
  const { t, sub } = useLang();
  const { can } = useSession();
  const { products, addCountedPickup, addProduct } = useStore();
  const key = draftKey(company.id, party.id);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState(today());
  const [query, setQuery] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [adding, setAdding] = useState(false);

  // Numbers typed so far are kept on the phone, so going back loses nothing.
  useEffect(() => {
    setQty(readDraft(key));
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (Object.keys(qty).length) window.localStorage.setItem(key, JSON.stringify(qty));
      else window.localStorage.removeItem(key);
    } catch {
      /* kept while the page is open */
    }
  }, [qty, key, loaded]);

  const items = products.filter((p) => p.companyId === company.id && (p.isActive || qty[p.id]));
  const q = query.trim().toLowerCase();
  const shown = items.filter((p) => (!onlyFilled || qty[p.id]) && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || String(p.mrp) === q.replace("₹", "")));
  // Grouped by category, in the order the products are listed.
  const groups = shown.reduce((m, p) => m.set(p.category || "—", [...(m.get(p.category || "—") ?? []), p]), new Map<string, Product[]>());

  const filled = items.filter((p) => (qty[p.id] ?? 0) > 0);
  const pieces = filled.reduce((s, p) => s + qty[p.id], 0);
  const value = filled.reduce((s, p) => s + qty[p.id] * claimRateOf(p, p.mrp), 0);
  const set = (id: string, raw: string) => {
    const n = Number(raw.replace(/\D/g, "").slice(0, 6)) || 0;
    setQty((prev) => {
      const next = { ...prev };
      if (n > 0) next[id] = n;
      else delete next[id];
      return next;
    });
  };

  function save() {
    const pickup = addCountedPickup(
      { companyId: company.id, distributorId: party.id, collectedDate: date || today() },
      filled.map((p) => ({ productId: p.id, mrp: p.mrp, quantity: qty[p.id] }))
    );
    if (!pickup) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to clear */
    }
    router.push(`/count/${pickup.id}/sort`);
  }

  return (
    <Screen width="wide">
      <TaskHeader back={`/direct?company=${company.id}`} tone="count" kicker={`${t("गिना हुआ माल", "Counted goods")} · ${company.name}`} aside={<CompanyAvatar company={company} size={44} />}>
        <p className="truncate font-display text-[22px] font-extrabold leading-tight">{party.name}</p>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1">
        <div className="flex items-center gap-2">
          <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-count">
            <SearchIcon size={22} className="text-ink-faint" />
            <input
              aria-label={t("सामान खोजें", "Search item")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("सामान, कैटेगरी या ₹…", "Item, category or ₹…")}
              className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <label className="flex h-[52px] shrink-0 flex-col justify-center rounded-2xl border border-line bg-surface px-3">
            <span className="text-[11px] font-bold leading-none text-ink-faint">{t("माल आया", "Received")}</span>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-[15px] font-semibold text-ink outline-none [color-scheme:dark]" />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="mx-0.5 text-[15px] font-bold">
            {t("हर सामान के पीस लिखें", "Type the pieces of each item")} <span className="font-medium text-ink-faint">· {sub("हर सामान के पीस लिखें", "Pieces of each item")}</span>
          </p>
          <button
            type="button"
            aria-pressed={onlyFilled}
            onClick={() => setOnlyFilled((v) => !v)}
            className={cn("h-10 shrink-0 rounded-full px-3.5 text-sm font-bold", onlyFilled ? "bg-count text-count-ink" : "border border-line bg-surface text-ink-dim")}
          >
            {t(`भरे हुए (${filled.length})`, `Filled (${filled.length})`)}
          </button>
        </div>

        {Array.from(groups).map(([category, list]) => (
          <section key={category} className="rounded-[18px] border border-line bg-surface">
            <p className="border-b border-line px-3.5 py-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-faint">{category}</p>
            <ul className="divide-y divide-line">
              {list.map((p) => {
                const n = qty[p.id] ?? 0;
                return (
                  <li key={p.id} className={cn("flex items-center gap-3 px-3.5 py-2", n > 0 && "bg-money-tint/40")}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold leading-tight">{p.name}</span>
                      <MrpChip mrp={p.mrp} className="mt-1" />
                    </span>
                    <input
                      aria-label={`${p.name} ${t("पीस", "pieces")}`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="next"
                      value={n ? String(n) : ""}
                      onChange={(e) => set(p.id, e.target.value)}
                      placeholder="0"
                      className={cn(
                        "h-12 w-24 shrink-0 rounded-xl border bg-canvas px-3 text-right font-display text-xl font-bold text-ink outline-none placeholder:text-ink-faint focus:border-count",
                        n > 0 ? "border-money-line" : "border-line"
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="rounded-2xl bg-surface p-4 text-center text-ink-dim">{onlyFilled ? t("अभी कुछ नहीं भरा", "Nothing filled in yet") : t("ऐसा कोई सामान नहीं", "No item like that")}</p>}

        {can("addProduct") && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-[17px] font-bold text-ink-dim hover:text-ink"
          >
            <PlusIcon size={22} />
            {t("सूची में नहीं? नया सामान", "Not listed? New item")}
          </button>
        )}
      </ScreenBody>

      <ScreenFooter>
        <div className="flex items-baseline justify-between px-1 text-[15px]">
          <span className="text-ink-dim">
            {t(`${filled.length} सामान`, `${filled.length} item${filled.length === 1 ? "" : "s"}`)} · <b className="text-ink">{num(pieces)}</b> {t("पीस", "pcs")}
          </span>
          <b className="font-display text-lg text-money">{inr(value)}</b>
        </div>
        <BigButton tone="count" onClick={save} disabled={pieces === 0} className="text-[21px]">
          {t("बैग में डालें · Put into bags", "Put into bags · बैग में डालें")}
        </BigButton>
        <Link href="/" className="flex h-9 items-center justify-center text-sm font-bold text-ink-dim">
          {t("बाद में — लिखा हुआ इस फ़ोन में रहेगा", "Later — what you typed stays on this phone")}
        </Link>
      </ScreenFooter>

      <NewItemSheet
        key={adding ? "open" : "closed"}
        open={adding}
        initialName={query}
        onClose={() => setAdding(false)}
        onSave={(name, mrp) => {
          addProduct({ companyId: company.id, sku: `NEW-${Date.now().toString().slice(-6)}`, name, category: "Other", unit: "piece", mrp, costPrice: Math.round(mrp * 0.8), isActive: true });
          setAdding(false);
          setQuery(name);
        }}
      />
    </Screen>
  );
}
