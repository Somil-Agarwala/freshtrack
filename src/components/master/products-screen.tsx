"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { MrpCircle, ProductPicture } from "@/components/ft/brand";
import { BoxIcon, PlusIcon } from "@/components/ft/icons";
import { EmptyCard, Field, Pill, SearchBox, Toggle, inputClass } from "@/components/ft/kit";
import { BigButton, CompanyTabs, ListHeader, Screen, ScreenBody } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";

const UNITS = ["piece", "pack", "bar", "sachet", "bottle", "pouch", "can", "box"];

/** Every item, with the MRP that decides its pile and the cost that values a loss. */
export function ProductsScreen({ initialSearch = "" }: { initialSearch?: string }) {
  const { t } = useLang();
  const { products, companies, countLines, saveProduct } = useStore();
  const [companyId, setCompanyId] = useState("all");
  const [query, setQuery] = useState(initialSearch);
  const [editing, setEditing] = useState<Product | null>(null);
  const { can } = useSession();

  const q = query.trim().toLowerCase();
  const list = products
    .filter((p) => (companyId === "all" || p.companyId === companyId) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  return (
    <Screen width="wide">
      <ListHeader
        tone="neutral"
        icon={<BoxIcon size={26} />}
        title={t("सामान", "Products")}
        subtitle={t("MRP से ढेर तय होता है, लागत से नुकसान", "MRP decides the pile, cost values a loss")}
      >
        <CompanyTabs companies={companies} value={companyId} onChange={setCompanyId} tone="count" all={t("सब कंपनी", "All")} />
      </ListHeader>
      <ScreenBody className="gap-3">
        <div className="flex gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t("नाम या SKU…", "Name or SKU…")} className="flex-1" />
          {can("addProduct") && (
          <button
            type="button"
            onClick={() =>
              setEditing({ id: `p-${Date.now()}`, companyId: companyId === "all" ? companies[0]?.id ?? "" : companyId, sku: "", name: query, category: "", unit: "piece", mrp: 10, costPrice: 8, isActive: true })
            }
            className="flex h-[54px] shrink-0 items-center gap-1.5 rounded-2xl bg-count px-4 font-bold text-count-ink"
          >
            <PlusIcon size={20} />
            {t("नया", "New")}
          </button>
          )}
        </div>
        {list.length === 0 && <EmptyCard title={t("कोई सामान नहीं", "No products")} />}
        <div className="grid gap-2 lg:grid-cols-2 [&>*]:min-w-0">
          {list.map((p) => {
            const company = companies.find((c) => c.id === p.companyId);
            const counted = countLines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.quantity, 0);
            return (
              <button key={p.id} type="button" disabled={!can("editMaster")} onClick={() => setEditing(p)} className={cn("flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3 text-left transition-colors hover:bg-elevated", !p.isActive && "opacity-60")}>
                <ProductPicture product={p} className="h-12 w-12 shrink-0" size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-bold leading-tight">{p.name}</span>
                  <span className="block truncate text-sm text-ink-dim">
                    {company?.name} · {p.sku} · {p.claimRate !== undefined ? `${t("क्लेम", "claim")} ₹${p.claimRate}` : `${t("लागत", "cost")} ₹${p.costPrice}`}/{p.unit}
                  </span>
                  {counted > 0 && <span className="block text-[13px] text-ink-faint">{t(`${counted.toLocaleString("en-IN")} पीस गिने गए`, `${counted.toLocaleString("en-IN")} pieces counted`)}</span>}
                </span>
                {p.isActive ? <MrpCircle mrp={p.mrp} size={44} /> : <Pill tone="neutral">{t("बंद", "Inactive")}</Pill>}
              </button>
            );
          })}
        </div>
      </ScreenBody>
      {editing && (
        <ProductSheet
          key={editing.id}
          product={editing}
          isNew={!products.some((p) => p.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            saveProduct(p);
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}

function ProductSheet({ product, isNew, onClose, onSave }: { product: Product; isNew: boolean; onClose: () => void; onSave: (p: Product) => void }) {
  const { t } = useLang();
  const { companies } = useStore();
  const [draft, setDraft] = useState(product);
  const valid = draft.name.trim() && draft.companyId && draft.mrp > 0;
  const number = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0);

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? t("नया सामान", "New product") : product.name}
      footer={
        <BigButton
          tone="count"
          disabled={!valid}
          onClick={() => onSave({ ...draft, name: draft.name.trim(), sku: draft.sku.trim() || `NEW-${Date.now().toString().slice(-6)}`, category: draft.category.trim() || "Other" })}
        >
          {t("सेव करें", "Save")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-4">
        <Field hi="कंपनी" en="Company">
          <select className={inputClass} value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field hi="नाम" en="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Glucose Biscuits 60g" autoFocus={isNew} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field hi="MRP ₹" en="MRP ₹" hint={!isNew ? t("पहले गिने माल का MRP नहीं बदलेगा", "Already-counted pieces keep their MRP") : undefined}>
            <input className={inputClass} inputMode="decimal" value={draft.mrp || ""} onChange={(e) => setDraft({ ...draft, mrp: number(e.target.value) })} />
          </Field>
          <Field hi="लागत ₹" en="Cost ₹">
            <input className={inputClass} inputMode="decimal" value={draft.costPrice || ""} onChange={(e) => setDraft({ ...draft, costPrice: number(e.target.value) })} />
          </Field>
        </div>
        <Field
          hi="क्लेम रेट ₹ (हर पीस)"
          en="Claim rate ₹ (per piece)"
          optional
          hint={t("कंपनी हर ख़राब पीस का कितना देती है। खाली छोड़ें तो MRP पर क्लेम होगा।", "What the company pays per damaged piece. Leave empty to claim at MRP.")}
        >
          <input
            className={inputClass}
            inputMode="decimal"
            value={draft.claimRate ?? ""}
            placeholder={t(`MRP ₹${draft.mrp}`, `MRP ₹${draft.mrp}`)}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setDraft({ ...draft, claimRate: v === "" ? undefined : Number(v) });
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field hi="SKU" en="SKU" optional>
            <input className={inputClass} value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })} placeholder={t("अपने आप", "Auto")} />
          </Field>
          <Field hi="किस्म" en="Category" optional>
            <input className={inputClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Biscuits" />
          </Field>
        </div>
        <Field hi="इकाई" en="Unit">
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([draft.unit, ...UNITS])).map((u) => (
              <button key={u} type="button" onClick={() => setDraft({ ...draft, unit: u })} className={cn("h-10 rounded-full px-3.5 text-[15px]", draft.unit === u ? "bg-count font-bold text-count-ink" : "border border-line bg-surface font-semibold")}>
                {u}
              </button>
            ))}
          </div>
        </Field>
        <Toggle on={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} label={t("चालू है", "Active")} detail={t("बंद सामान गिनती में नहीं दिखता", "Inactive items are hidden while counting")} />
      </div>
    </Dialog>
  );
}
