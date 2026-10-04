"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { REASON_HI, REASON_LABELS } from "@/lib/constants";
import { inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn, today } from "@/lib/utils";
import type { ReasonCategory, SourceType } from "@/types";
import { CompanyAvatar, MrpChip, ProductPicture } from "@/components/ft/brand";
import { CameraIcon, CheckIcon, InfoIcon, MinusIcon, PlusIcon } from "@/components/ft/icons";
import { ChoiceGrid, Field, SearchBox, inputClass } from "@/components/ft/kit";
import { BigButton, Note, Question, Screen, ScreenBody, ScreenFooter, StepHeader, softButton } from "@/components/ft/screen";

const UNITS = ["pieces", "packs", "cartons", "kg", "litres"];
const WHO = ["Warehouse Team", "Delivery Partner", "Transporter"];

/**
 * Logging damage to your own stock in three taps-worth of steps:
 * company, item, then what happened. Choices live in the address bar so
 * the phone's back button steps back.
 */
export function GodownEntry() {
  const params = useSearchParams();
  const { companies, products } = useStore();
  const company = companies.find((c) => c.id === params.get("company"));
  const product = products.find((p) => p.id === params.get("product") && p.companyId === company?.id);
  const source: SourceType = params.get("source") === "party" ? "distributor" : "own_inventory";

  if (!company) return <PickCompany source={source} />;
  if (!product) return <PickItem companyId={company.id} source={source} />;
  return <Details companyId={company.id} productId={product.id} source={source} />;
}

function qs(source: SourceType, rest: Record<string, string>) {
  const p = new URLSearchParams(rest);
  if (source === "distributor") p.set("source", "party");
  return `/godown/new?${p.toString()}`;
}

function PickCompany({ source }: { source: SourceType }) {
  const { t } = useLang();
  const { companies } = useStore();
  const tab = (value: SourceType, hi: string, en: string) => (
    <Link
      href={qs(value, {})}
      replace
      aria-current={source === value ? "true" : undefined}
      className={cn("flex h-[52px] flex-1 items-center justify-center rounded-[14px] text-base", source === value ? "bg-godown font-bold text-godown-ink" : "font-semibold text-ink-dim")}
    >
      {t(hi, en)}
    </Link>
  );

  return (
    <Screen>
      <StepHeader back="/godown" step={1} total={3} tone="godown" hi="गोदाम नुकसान" en="Godown damage" />
      <ScreenBody className="gap-4 pt-4">
        <div className="flex gap-1 rounded-[18px] bg-elevated p-1">
          {tab("own_inventory", "अपना गोदाम", "Own godown")}
          {tab("distributor", "पार्टी ने बताया", "Party reported")}
        </div>
        <Question hi="किस कंपनी का माल ख़राब हुआ?" en="Whose goods got damaged?" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {companies
            .filter((c) => c.isActive)
            .map((c) => (
              <Link key={c.id} href={qs(source, { company: c.id })} className="flex min-h-[116px] flex-col gap-3 rounded-[20px] border-2 border-line bg-surface p-4 transition-colors hover:border-godown/60">
                <CompanyAvatar company={c} size={52} />
                <span className="font-display text-xl font-bold leading-[1.1]">{c.name}</span>
              </Link>
            ))}
        </div>
        <Note
          tone="godown"
          icon={<InfoIcon size={22} />}
          hi="यह अपने स्टॉक का नुकसान है। पार्टी से लाया माल 'नया माल' में दर्ज करें।"
          en="This is for your own stock. Goods picked up from a party go under New pickup."
        />
      </ScreenBody>
    </Screen>
  );
}

function PickItem({ companyId, source }: { companyId: string; source: SourceType }) {
  const { t } = useLang();
  const { companies, products } = useStore();
  const [query, setQuery] = useState("");
  const company = companies.find((c) => c.id === companyId);
  const q = query.trim().toLowerCase();
  const list = products.filter((p) => p.companyId === companyId && p.isActive && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));

  return (
    <Screen>
      <StepHeader back={qs(source, {})} step={2} total={3} tone="godown" hi="गोदाम नुकसान" en="Godown damage" />
      <ScreenBody className="pt-3.5">
        <Link href={qs(source, {})} className="flex items-center gap-2 self-start rounded-full bg-elevated py-1.5 pl-1.5 pr-3.5 text-[15px] font-semibold">
          <CompanyAvatar company={company} size={32} />
          {company?.name} <span className="text-sm text-godown">· {t("बदलें", "Change")}</span>
        </Link>
        <Question hi="कौन सा सामान?" en="Which item?" />
        <SearchBox value={query} onChange={setQuery} placeholder={t("सामान ढूँढें…", "Find an item…")} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} href={qs(source, { company: companyId, product: p.id })} className="flex flex-col gap-2 rounded-[18px] border-2 border-line bg-surface p-3 transition-colors hover:bg-elevated">
              <ProductPicture product={p} className="h-[52px]" />
              <span className="text-base font-bold leading-[1.2]">{p.name}</span>
              <span className="mt-auto flex items-center justify-between">
                <MrpChip mrp={p.mrp} />
                <span className="text-[13px] text-ink-faint">
                  {t("लागत", "cost")} ₹{p.costPrice}
                </span>
              </span>
            </Link>
          ))}
        </div>
        {list.length === 0 && (
          <p className="rounded-2xl bg-surface p-4 text-center text-ink-dim">
            {t("सामान नहीं मिला।", "No item found.")}{" "}
            <Link href="/master-data/products" className="font-bold text-godown">
              {t("सामान की सूची में जोड़ें", "Add it to products")}
            </Link>
          </p>
        )}
      </ScreenBody>
    </Screen>
  );
}

function Details({ companyId, productId, source }: { companyId: string; productId: string; source: SourceType }) {
  const router = useRouter();
  const { t, sub } = useLang();
  const { companies, products, distributors, addRecord } = useStore();
  const company = companies.find((c) => c.id === companyId);
  const product = products.find((p) => p.id === productId)!;

  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState(product.unit.endsWith("s") ? product.unit : `${product.unit}s`);
  const [reason, setReason] = useState<ReasonCategory | "">("");
  const [batch, setBatch] = useState("");
  const [date, setDate] = useState(today());
  const [partyId, setPartyId] = useState("");
  const [who, setWho] = useState(source === "own_inventory" ? WHO[0] : "");
  const [customWho, setCustomWho] = useState("");
  const [loss, setLoss] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const estimate = qty * product.costPrice;
  const value = loss === null ? estimate : Number(loss) || 0;
  const party = distributors.find((d) => d.id === partyId);
  const units = useMemo(() => Array.from(new Set([unit, ...UNITS])), [unit]);
  const whoOptions = [...(party ? [party.name] : []), ...WHO, "other"];
  const responsible = who === "other" ? customWho.trim() : who;
  const ready = !!reason && qty > 0 && (source === "own_inventory" || !!partyId);

  function save() {
    if (!ready) return;
    addRecord({
      companyId,
      date,
      source,
      distributorId: source === "distributor" ? partyId : undefined,
      productId,
      batchNumber: batch.trim(),
      quantity: qty,
      unit,
      reason: reason as ReasonCategory,
      costValue: value,
      status: "pending_review",
      responsibleParty: responsible,
      hasPhoto: !!photo,
      notes: notes.trim() || undefined,
    });
    router.replace(`/godown/done?${new URLSearchParams({ company: companyId, product: productId, qty: String(qty), unit, value: String(value), ...(source === "distributor" ? { source: "party" } : {}) })}`);
  }

  return (
    <Screen>
      <StepHeader back={qs(source, { company: companyId })} step={3} total={3} tone="godown" hi="गोदाम नुकसान" en="Godown damage" />
      <ScreenBody className="gap-4 pt-3.5">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <ProductPicture product={product} className="h-12 w-12 shrink-0" size={24} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold leading-tight">{product.name}</span>
            <span className="block truncate text-sm text-ink-dim">
              {company?.name} · MRP ₹{product.mrp} · {t("लागत", "cost")} ₹{product.costPrice}/{product.unit}
            </span>
          </span>
          <Link href={qs(source, { company: companyId })} className="text-sm font-bold text-godown">
            {t("बदलें", "Change")}
          </Link>
        </div>

        {source === "distributor" && (
          <Field hi="किस पार्टी ने बताया?" en="Which party reported it?">
            <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">{t("पार्टी चुनें", "Pick a party")}</option>
              {distributors
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
        )}

        <Field hi="कितना माल ख़राब हुआ?" en="How much is damaged?">
          <div className="flex items-center gap-2 rounded-[22px] border border-line bg-surface p-2.5">
            <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label={t("कम", "Less")} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-elevated">
              <MinusIcon size={26} />
            </button>
            <input
              inputMode="numeric"
              aria-label={t("मात्रा", "Quantity")}
              value={qty}
              onChange={(e) => setQty(Math.max(0, Number(e.target.value.replace(/\D/g, "").slice(0, 6)) || 0))}
              className="min-w-0 flex-1 bg-transparent text-center font-display text-[44px] font-extrabold leading-none text-godown outline-none"
            />
            <button type="button" onClick={() => setQty((n) => n + 1)} aria-label={t("ज़्यादा", "More")} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-godown text-godown-ink">
              <PlusIcon size={26} />
            </button>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {units.map((u) => (
              <button key={u} type="button" onClick={() => setUnit(u)} className={cn("h-10 shrink-0 rounded-full px-3.5 text-[15px]", unit === u ? "bg-godown font-bold text-godown-ink" : "border border-line bg-surface font-semibold")}>
                {u}
              </button>
            ))}
          </div>
        </Field>

        <Field hi="क्या हुआ?" en="What happened?">
          <ChoiceGrid
            tone="godown"
            value={reason}
            onChange={setReason}
            options={(Object.keys(REASON_HI) as ReasonCategory[]).map((r) => ({ value: r, label: t(REASON_HI[r], REASON_LABELS[r]), detail: sub(REASON_HI[r], REASON_LABELS[r]) }))}
          />
        </Field>

        <div className="rounded-[20px] border border-godown-line bg-godown-panel p-4">
          <p className="text-[15px] font-bold text-godown-soft">
            {t("नुकसान", "Loss")} · {sub("नुकसान", "Loss")}
          </p>
          {loss === null ? (
            <>
              <p className="font-display text-[34px] font-extrabold leading-tight text-godown">{inr(estimate)}</p>
              <p className="text-sm text-godown-mute">
                {num(qty)} × ₹{product.costPrice} {t("लागत", "cost")} ·{" "}
                <button type="button" onClick={() => setLoss(String(estimate))} className="font-bold text-godown-soft underline">
                  {t("रकम बदलें", "change amount")}
                </button>
              </p>
            </>
          ) : (
            <label className="mt-1 flex h-14 items-center gap-2 rounded-2xl border-2 border-godown bg-canvas px-4 font-display text-[28px] font-extrabold">
              ₹
              <input inputMode="numeric" autoFocus value={loss} onChange={(e) => setLoss(e.target.value.replace(/\D/g, "").slice(0, 9))} aria-label={t("नुकसान की रकम", "Loss amount")} className="min-w-0 flex-1 bg-transparent text-ink outline-none" />
            </label>
          )}
        </div>

        <Field hi="किसकी ज़िम्मेदारी?" en="Who is responsible?" optional>
          <div className="flex flex-wrap gap-2">
            {whoOptions.map((w) => (
              <button key={w} type="button" onClick={() => setWho(w)} className={cn("h-11 rounded-full px-3.5 text-[15px]", who === w ? "bg-godown font-bold text-godown-ink" : "border border-line bg-surface font-semibold")}>
                {w === "other" ? t("कोई और", "Someone else") : w}
              </button>
            ))}
          </div>
          {who === "other" && <input className={inputClass} value={customWho} onChange={(e) => setCustomWho(e.target.value)} placeholder={t("नाम लिखें", "Type a name")} />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field hi="बैच नंबर" en="Batch" optional>
            <input className={inputClass} value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="B26-0091" />
          </Field>
          <Field hi="तारीख" en="Date">
            <input type="date" className={inputClass} value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
        </div>

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPhoto(URL.createObjectURL(file));
          }}
        />
        <button type="button" onClick={() => photoInput.current?.click()} className={`${softButton} h-14 border-line bg-surface text-[17px]`}>
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={photo} alt="" className="h-9 w-9 rounded-lg object-cover" />
              <CheckIcon size={20} className="text-money" />
              {t("फोटो लगी · बदलें", "Photo added · change")}
            </>
          ) : (
            <>
              <CameraIcon size={22} />
              {t("ख़राब माल की फोटो लें", "Photo of the damage")}
            </>
          )}
        </button>

        <Field hi="कुछ और लिखना है?" en="Notes" optional>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={cn(inputClass, "h-auto py-3")} placeholder={t("जैसे: छत से पानी टपका", "e.g. roof leaked overnight")} />
        </Field>
      </ScreenBody>

      <ScreenFooter>
        <BigButton tone="godown" onClick={save} disabled={!ready}>
          <CheckIcon />
          {ready ? t(`सेव करें · ${inr(value)} नुकसान`, `Save · ${inr(value)} loss`) : !reason ? t("पहले वजह चुनें", "Pick what happened") : t("पार्टी चुनें", "Pick the party")}
        </BigButton>
      </ScreenFooter>
    </Screen>
  );
}
