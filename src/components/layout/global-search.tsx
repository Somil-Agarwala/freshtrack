"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Result {
  key: string;
  group: string;
  label: string;
  sub?: string;
  href: string;
  mono?: boolean;
}

const PER_GROUP = 5;

// The top-bar search used to be a dead input. It now finds collection
// bags, dispatches, sorted bags, products and parties from one box --
// on a phone, the fastest way to reach a bag whose number is on the label
// in your hand.
function findResults(store: ReturnType<typeof useStore>, query: string): Result[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const has = (...values: (string | undefined)[]) => values.some((v) => v?.toLowerCase().includes(q));
  const party = (id?: string) => store.distributors.find((d) => d.id === id)?.name;
  const company = (id: string) => store.companies.find((c) => c.id === id)?.name;

  return [
    ...store.collections
      .filter((c) => has(c.bagNumber, party(c.distributorId)))
      .slice(0, PER_GROUP)
      .map((c) => ({ key: `c-${c.id}`, group: "Collection bags", label: c.bagNumber, sub: `${company(c.companyId)} · ${party(c.distributorId)}`, href: `/collections/${c.id}`, mono: true })),
    ...store.dispatches
      .filter((d) => has(d.dispatchNumber, company(d.companyId)))
      .slice(0, PER_GROUP)
      .map((d) => ({ key: `d-${d.id}`, group: "Dispatches", label: d.dispatchNumber, sub: `${company(d.companyId)} factory`, href: `/dispatches/${d.id}`, mono: true })),
    ...store.sortedBags
      .filter((b) => has(b.bagNumber))
      .slice(0, PER_GROUP)
      .map((b) => ({ key: `b-${b.id}`, group: "Sorted bags", label: b.bagNumber, sub: `${company(b.companyId)} · MRP ${b.mrp}`, href: `/sorted-bags?q=${encodeURIComponent(b.bagNumber)}`, mono: true })),
    ...store.products
      .filter((p) => has(p.sku, p.name))
      .slice(0, PER_GROUP)
      .map((p) => ({ key: `p-${p.id}`, group: "Products", label: p.name, sub: `${p.sku} · ${company(p.companyId)}`, href: `/master-data/products?q=${encodeURIComponent(p.sku)}` })),
    ...store.distributors
      .filter((d) => has(d.name, d.region, d.contactName))
      .slice(0, PER_GROUP)
      .map((d) => ({ key: `r-${d.id}`, group: "Parties", label: d.name, sub: d.region, href: `/master-data/distributors?q=${encodeURIComponent(d.name)}` })),
  ];
}

function ResultList({ results, active, onPick, query }: { results: Result[]; active: number; onPick: (r: Result) => void; query: string }) {
  if (query.trim().length < 2) return <p className="px-4 py-6 text-center text-sm text-ink-faint">Type a bag number, SKU, product or party.</p>;
  if (results.length === 0) return <p className="px-4 py-6 text-center text-sm text-ink-dim">Nothing matches &ldquo;{query.trim()}&rdquo;.</p>;
  return (
    <ul role="listbox" className="py-1">
      {results.map((r, i) => (
        <li key={r.key}>
          {(i === 0 || results[i - 1].group !== r.group) && (
            <p className="px-4 pb-1 pt-3 text-xs font-medium text-ink-faint">{r.group}</p>
          )}
          <button
            type="button"
            role="option"
            aria-selected={i === active}
            // mousedown, not click: fires before the input's blur closes the list.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(r);
            }}
            className={cn("flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-raised", i === active && "bg-raised")}
          >
            <span className={cn("text-sm font-medium text-ink", r.mono && "font-mono")}>{r.label}</span>
            {r.sub && <span className="text-xs text-ink-faint">{r.sub}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function GlobalSearch() {
  const store = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(0);
  const mobileInput = useRef<HTMLInputElement>(null);

  const results = useMemo(() => findResults(store, query), [store, query]);
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileInput.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  function pick(r: Result) {
    setQuery("");
    setFocused(false);
    setMobileOpen(false);
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setFocused(false);
      setMobileOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 sm:text-sm";

  return (
    <>
      {/* Tablet and desktop: an inline box with a dropdown. */}
      <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search bags, SKUs, parties..."
          aria-label="Search"
          className={inputClass}
        />
        {focused && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-line-strong bg-elevated sm:w-[28rem]">
            <ResultList results={results} active={active} onPick={pick} query={query} />
          </div>
        )}
      </div>

      {/* Phone: an icon that opens a full-screen search. */}
      <button
        onClick={() => setMobileOpen(true)}
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-dim hover:bg-elevated sm:hidden"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>
      {/* Portalled to <body>: the header's backdrop blur makes it the
          containing block for fixed children, which would squeeze this
          full-screen panel into the 64px bar. */}
      {mobileOpen && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-base sm:hidden" role="dialog" aria-modal="true" aria-label="Search">
          <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-3">
            <button onClick={() => setMobileOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-dim" aria-label="Close search">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                ref={mobileInput}
                type="search"
                enterKeyHint="go"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Bag number, SKU, product, party"
                aria-label="Search"
                className={inputClass}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <ResultList results={results} active={active} onPick={pick} query={query} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
