"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { claimRateOf } from "@/lib/claim";
import { useFlash, useVoiceInput } from "@/lib/device";
import { inr, num } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CollectionBag, Product } from "@/types";
import { CompanyAvatar, MrpChip, MrpCircle, ProductPicture } from "@/components/ft/brand";
import { CheckIcon, MicIcon, PlusIcon, SearchIcon } from "@/components/ft/icons";
import { BigButton, Screen, ScreenBody, ScreenFooter, TaskHeader } from "@/components/ft/screen";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { useCountDraft } from "./count-draft";

/**
 * Set when the keypad was opened from the tiles, so closing it can step
 * back in history instead of stacking another copy of the tile screen.
 * Opened any other way (a reload, a shared link) it replaces instead.
 */
let openedFromTiles = false;

/**
 * Counting one bag. Tap the item, type how many on the big keypad, repeat;
 * "Done counting" saves and moves on to sorting the pieces into piles.
 * The keypad has its own address (?item=) so the phone's back button
 * returns to the item tiles.
 */
export function CountScreen({ collectionId }: { collectionId: string }) {
  const { collections, products, countLines } = useStore();
  const drafts = useCountDraft();
  const params = useSearchParams();
  const bag = collections.find((c) => c.id === collectionId);

  // A bag being re-counted starts from what was saved for it last time.
  const saved = useMemo(() => {
    const lines = countLines.filter((l) => l.collectionId === collectionId);
    return Object.fromEntries(lines.reduce((m, l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity), new Map<string, number>()));
  }, [countLines, collectionId]);
  const draft = drafts.get(collectionId) ?? saved;

  if (!bag) return <NotFound />;
  // Pieces already tied into bags cannot be re-counted without losing them.
  if (countLines.some((l) => l.collectionId === bag.id && l.packed)) return <NotFound locked bagId={bag.id} />;
  const itemId = params.get("item");
  const item = itemId ? products.find((p) => p.id === itemId) : undefined;

  if (item) {
    return <Keypad bag={bag} product={item} current={draft[item.id] ?? 0} edit={params.get("edit") === "1"} onSave={(qty) => drafts.set(bag.id, { ...draft, [item.id]: qty })} />;
  }
  return <ItemTiles bag={bag} draft={draft} />;
}

function ItemTiles({ bag, draft }: { bag: CollectionBag; draft: Record<string, number> }) {
  const router = useRouter();
  const { t, sub, lang } = useLang();
  const { products, companies, saveCount, addProduct } = useStore();
  const drafts = useCountDraft();
  const { can } = useSession();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, flash] = useFlash();
  const voice = useVoiceInput(setQuery, lang);
  const company = companies.find((c) => c.id === bag.companyId);

  const companyProducts = products.filter((p) => p.companyId === bag.companyId && (p.isActive || draft[p.id]));
  const q = query.trim().toLowerCase();
  const visible = companyProducts.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || String(p.mrp) === q.replace("₹", ""));
  const lines = companyProducts.filter((p) => (draft[p.id] ?? 0) > 0);
  const total = lines.reduce((s, p) => s + draft[p.id], 0);
  const keypad = (p: Product, edit = false) => `/count/${bag.id}?item=${p.id}${edit ? "&edit=1" : ""}`;

  function done() {
    saveCount(
      bag.id,
      lines.map((p) => ({ productId: p.id, mrp: p.mrp, quantity: draft[p.id] }))
    );
    drafts.clear(bag.id);
    router.push(`/count/${bag.id}/sort`);
  }

  return (
    <Screen>
      <TaskHeader back="/count" tone="count" kicker={`${t("गिनती चल रही है", "Counting")} · ${sub("गिनती चल रही है", "Counting")}`} aside={<CompanyAvatar company={company} size={44} />}>
        <p className="truncate font-mono text-[17px] font-semibold">{bag.bagNumber}</p>
      </TaskHeader>

      <ScreenBody className="gap-3 pt-1.5">
        <section aria-label={t("अब तक गिना", "Counted so far")} className="rounded-[18px] border border-line bg-surface px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-bold text-ink-dim">
              {t("अब तक गिना", "So far")} · {sub("अब तक गिना", "So far")}
            </p>
            <p className="font-display text-[22px] font-extrabold text-count">
              {num(total)} {t("पीस", "pcs")}
            </p>
          </div>
          {lines.length === 0 ? (
            <p className="mt-1 text-[15px] text-ink-faint">{t("अभी कुछ नहीं गिना — नीचे सामान पर टैप करें", "Nothing yet — tap an item below")}</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {lines.map((p) => (
                <Link key={p.id} href={keypad(p, true)} onClick={() => (openedFromTiles = true)} className="flex items-center gap-2.5 rounded-lg text-base hover:bg-elevated">
                  <MrpCircle mrp={p.mrp} size={34} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <b className="font-bold">{num(draft[p.id])}</b>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="flex gap-2">
          <label className="flex h-[54px] min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-count">
            <SearchIcon size={22} className="text-ink-faint" />
            <input
              aria-label={t("सामान खोजें", "Search item")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("सामान ढूँढें…", "Find an item…")}
              className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <button
            type="button"
            aria-label={t("बोलकर खोजें", "Search by voice")}
            onClick={() => voice.start() || flash(t("इस फ़ोन पर बोलकर खोज नहीं चलती", "Voice search is not available on this phone"))}
            className={cn("flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl bg-elevated text-count", voice.listening && "animate-pulse")}
          >
            <MicIcon />
          </button>
        </div>

        <p className="mx-0.5 text-base font-bold">
          {t("सामान पर टैप करें", "Tap the item you are counting")} <span className="font-medium text-ink-faint">· {sub("सामान पर टैप करें", "Tap the item you are counting")}</span>
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {visible.map((p) => {
            const qty = draft[p.id] ?? 0;
            return (
              <Link
                key={p.id}
                href={keypad(p)}
                onClick={() => (openedFromTiles = true)}
                className={cn("flex flex-col gap-2 rounded-[18px] border-2 bg-surface p-3 transition-colors hover:bg-elevated", qty > 0 ? "border-money-line" : "border-line")}
              >
                <ProductPicture product={p} className="h-[52px]" />
                <span className="text-base font-bold leading-[1.2]">{p.name}</span>
                <span className="mt-auto flex items-center justify-between">
                  <MrpChip mrp={p.mrp} />
                  {qty > 0 && <span className="text-[15px] font-bold text-money">✓ {num(qty)}</span>}
                </span>
              </Link>
            );
          })}
          {can("addProduct") && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-line-strong p-3 text-center text-[15px] font-bold text-ink-dim hover:text-ink"
          >
            <PlusIcon size={24} />
            {t("नया सामान", "New item")}
            <span className="text-[13px] font-medium text-ink-faint">{sub("सूची में नहीं है?", "Not in the list?")}</span>
          </button>
          )}
        </div>
      </ScreenBody>

      <ScreenFooter>
        <BigButton tone="count" onClick={done} disabled={total === 0} className="text-[21px]">
          <CheckIcon />
          {t("गिनती पूरी · Done counting", "Done counting · गिनती पूरी")}
        </BigButton>
      </ScreenFooter>

      <NewItemSheet
        key={adding ? "open" : "closed"}
        open={adding}
        initialName={query}
        onClose={() => setAdding(false)}
        onSave={(name, mrp) => {
          const created = addProduct({
            companyId: bag.companyId,
            sku: `NEW-${Date.now().toString().slice(-6)}`,
            name,
            category: "Other",
            unit: "piece",
            mrp,
            costPrice: Math.round(mrp * 0.8),
            isActive: true,
          });
          setAdding(false);
          setQuery("");
          openedFromTiles = true;
          router.push(keypad(created));
        }}
      />
      <Notice message={message} />
    </Screen>
  );
}

const COMMON_MRPS = [5, 10, 20, 30, 50];

function NewItemSheet({ open, initialName, onClose, onSave }: { open: boolean; initialName: string; onClose: () => void; onSave: (name: string, mrp: number) => void }) {
  const { t } = useLang();
  const [name, setName] = useState(initialName);
  const [mrp, setMrp] = useState("");
  const value = Number(mrp);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("नया सामान", "New item")}
      footer={
        <BigButton tone="count" disabled={!name.trim() || !value} onClick={() => onSave(name.trim(), value)}>
          {t("जोड़ें", "Add")}
        </BigButton>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          className="h-14 rounded-2xl border border-line bg-canvas px-4 text-[17px] text-ink outline-none placeholder:text-ink-faint focus:border-count"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("सामान का नाम", "Item name")}
          autoFocus
        />
        <p className="text-[15px] font-bold">{t("MRP कितना छपा है?", "What MRP is printed?")}</p>
        <div className="flex flex-wrap gap-2">
          {COMMON_MRPS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMrp(String(m))}
              className={cn("h-12 min-w-14 rounded-2xl px-3 text-lg font-bold", value === m ? "bg-count text-count-ink" : "bg-elevated")}
            >
              ₹{m}
            </button>
          ))}
          <input
            inputMode="numeric"
            value={COMMON_MRPS.includes(value) ? "" : mrp}
            onChange={(e) => setMrp(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder={t("दूसरा ₹", "Other ₹")}
            className="h-12 w-28 rounded-2xl border border-line bg-canvas px-3 text-lg text-ink outline-none placeholder:text-ink-faint focus:border-count"
          />
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

function Keypad({ bag, product, current, edit, onSave }: { bag: CollectionBag; product: Product; current: number; edit: boolean; onSave: (qty: number) => void }) {
  const router = useRouter();
  const { t, sub } = useLang();
  const [entry, setEntry] = useState(edit ? String(current) : "0");
  const qty = Number(entry) || 0;
  const result = edit ? qty : current + qty;
  const back = `/count/${bag.id}`;

  // A hardware keyboard works too (desktop, or a phone with a keypad).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Escape") press("C");
      else if (e.key === "Enter") save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function press(key: string) {
    setEntry((value) => {
      if (key === "C") return "0";
      if (key === "⌫") return value.length > 1 ? value.slice(0, -1) : "0";
      if (value.length >= 5) return value;
      return value === "0" ? key : value + key;
    });
  }

  function close() {
    if (openedFromTiles) {
      openedFromTiles = false;
      router.back();
    } else {
      router.replace(back);
    }
  }

  function save() {
    if (!edit && qty === 0) return;
    onSave(result);
    close();
  }

  return (
    <Screen>
      <TaskHeader back={back} tone="count" kicker={`${t("गिनती", "Count")} · ${bag.bagNumber}`}>
        <p className="text-[15px] text-ink-dim">
          {t("कितने पीस?", "How many pieces?")} · {sub("कितने पीस?", "How many pieces?")}
        </p>
      </TaskHeader>

      <ScreenBody className="gap-3 pb-3 pt-1.5">
        <div className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3">
          <ProductPicture product={product} className="h-14 w-14 shrink-0 rounded-[14px]" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl font-bold leading-[1.15]">{product.name}</span>
            <button type="button" onClick={close} className="text-sm font-semibold text-count">
              {t("गलत सामान? बदलें", "Wrong item? Change")}
            </button>
          </span>
          <MrpCircle mrp={product.mrp} size={58} />
        </div>

        <div className="flex items-baseline justify-between gap-3 rounded-[20px] border-2 border-count bg-bar px-4 py-2.5">
          <span aria-live="polite" className="font-display text-[64px] font-extrabold leading-[1.05] text-white">
            {num(qty)}
          </span>
          <span className="text-right">
            <span className="block text-lg font-bold text-count">{t("पीस", "pieces")}</span>
            <span className="block text-[15px] text-ink-dim">= {inr(qty * claimRateOf(product, product.mrp))}</span>
          </span>
        </div>
        {!edit && current > 0 && (
          <p className="-mt-1 text-center text-[15px] text-ink-dim">
            {t(`पहले ${num(current)} गिने · अब कुल ${num(result)}`, `${num(current)} counted before · ${num(result)} in all`)}
          </p>
        )}

        <div className="grid flex-1 grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key === "C" ? "Clear" : key === "⌫" ? "Delete last digit" : key}
              className={cn(
                "min-h-16 rounded-2xl font-display text-[30px] font-bold text-ink active:brightness-125",
                key === "C" ? "bg-danger-tint" : key === "⌫" ? "bg-raised" : "bg-elevated"
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </ScreenBody>

      <ScreenFooter>
        <BigButton tone="count" onClick={save} disabled={!edit && qty === 0} className="text-[21px]">
          <CheckIcon />
          {edit
            ? t(`सेव करें · ${num(qty)} पीस`, `Save · ${num(qty)} pieces`)
            : t(`जोड़ें · Add ${num(qty)} पीस`, `Add ${num(qty)} pieces`)}
        </BigButton>
      </ScreenFooter>
    </Screen>
  );
}

function NotFound({ locked, bagId }: { locked?: boolean; bagId?: string }) {
  const { t } = useLang();
  return (
    <Screen>
      <ScreenBody className="items-center justify-center text-center">
        <p className="text-lg text-ink-dim">
          {locked ? t("इस बैग का माल बैग में बँध चुका है, अब गिनती नहीं बदल सकते", "This bag's pieces are already tied into bags, so the count is final") : t("यह बैग नहीं मिला", "This bag was not found")}
        </p>
        {bagId && (
          <Link href={`/collections/${bagId}`} className="font-bold text-pickup">
            {t("बैग देखें", "See the bag")}
          </Link>
        )}
        <Link href="/count" className="font-bold text-count">
          {t("गिनती की सूची देखें", "Back to the count list")}
        </Link>
      </ScreenBody>
    </Screen>
  );
}
