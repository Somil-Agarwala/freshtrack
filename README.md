# FreshTrack

Damage collection, counting, bag packing and factory claims for an FMCG
distribution business. Built as a multi-file Next.js app that drops
straight into GitHub and Vercel, with Supabase planned for the backend.

This build is **UI and logic only**: it runs on realistic mock data in
`src/lib/mock-data.ts`, held in a shared in-memory store. Nothing is
persisted yet, so a page refresh resets state.

## The workflow this models

The app follows the physical process rather than inventing its own:

```
  1. COLLECT   Pick damaged stock up from a party. Log it immediately.
               A collection bag number (COL-2026-0001) is generated and
               the bag is marked "Not counted". A rough piece count can
               be recorded now and reconciled later.

  2. COUNT     Open the bag and count it, SKU by SKU, on the count
               sheet. Running totals update as you go and are compared
               against the rough count from pickup. The bag becomes
               "Counted".

  3. PACK      Counted pieces are regrouped BY MRP, not by SKU and not
               by party, and packed 700 to a bag. Bag numbers are
               generated with the MRP in them (M10-2026-0008) so the
               tier is readable off the physical label.

  4. DISPATCH  Select the bags going to the factory, send them as one
               dispatch, and download the report. Record what actually
               came back against what was claimed.
```

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How bag packing works

`src/lib/bag-packing.ts` holds the logic, and it is worth understanding
before changing anything:

- **Capacity is one constant.** `BAG_CAPACITY = 700`. Change it there and
  every preview, projection and generated bag follows.
- **Pieces pool across collection bags.** If Ganga Traders returns 900
  pieces at MRP 10 and Purvanchal returns 750, those pool into 1,650 and
  become three bags (700 + 700 + 250), not two part-filled bags per
  party. Pooling is what actually fills bags. Traceability is preserved
  through `sourceCollectionIds` on every bag, and the exported report has
  a Traceability sheet showing which party contributed what.
- **The trailing bag is flagged.** The last bag in a tier is marked
  part-filled rather than being silently treated as full.
- **Nothing is generated blind.** The packing panel shows the full split
  per MRP tier — pieces, full bags, remainder, value — before you
  generate anything.

## Project structure

```
src/
├── app/                          Routes (Next.js App Router)
│   ├── page.tsx                  Dashboard
│   ├── collections/              List + [collectionId] detail & counting
│   ├── sorted-bags/              Packing preview + MRP bags
│   ├── dispatches/               List + [dispatchId] detail & settlement
│   ├── new-entry/                Own-inventory damage form
│   ├── records/                  Own-inventory records
│   ├── master-data/              Products, Parties
│   ├── reports/  users/  settings/
│   ├── globals.css               THE ENTIRE THEME LIVES HERE
│   └── layout.tsx
├── components/
│   ├── layout/                   Sidebar, Topbar, AppShell
│   ├── ui/                       16 primitives, all dark-native
│   ├── collections/              Count sheet, detail, list, dialog
│   ├── sorted-bags/              Packing panel + bag list
│   ├── dispatches/               List + detail with settlement
│   └── dashboard/ records/ new-entry/ master-data/ reports/ users/ settings/
├── lib/
│   ├── bag-packing.ts            MRP tiers + 700-piece packing
│   ├── store.tsx                 Shared state; the ONLY place data mutates
│   ├── export.ts                 All Excel exports
│   ├── mock-data.ts  constants.ts  utils.ts
├── config/                       nav.ts, site.ts
└── types/index.ts                The full domain model
```

## The theme

Every colour resolves to a CSS variable in `src/app/globals.css`, mapped
to Tailwind names in `tailwind.config.ts`. Components use semantic
classes (`bg-surface`, `text-ink-dim`, `border-line`) and never hardcode
a palette value.

That means retheming — or adding a light mode later — is an edit to one
block of variables, not a find-and-replace across seventy components.

Surfaces step up in lightness as they come forward: `base` → `surface` →
`elevated` → `raised`. The base is a cool near-black rather than pure
black, which avoids the halation that makes long data-entry sessions
tiring on OLED screens.

## Mobile

- Sidebar is a hover-expanding 72px icon rail at `lg` and above, and an
  off-canvas drawer below that, opened by the hamburger. Hover does not
  exist on touch, so entry is an explicit tap.
- Every table becomes a card stack below `md` (768px). Tables never
  scroll sideways.
- Bulk actions appear in a fixed bottom bar, in the thumb zone, offset
  past the desktop rail.
- Checkboxes stay visually small but sit inside 40px tappable labels.

## Excel exports

- **Sorted bags** → three sheets: Bag Manifest (tick off bag by bag at
  the factory), MRP Summary (the claim total), Traceability (which party
  contributed which pieces).
- **Dispatch** → dispatch summary plus its bag manifest.
- **Collections** and **Records** → the current filtered view.

Every export respects whatever filters are active on screen, so filtering
by party or MRP and then exporting gives exactly that slice.

## Bulk actions

Collections, sorted bags, dispatches and records all support multi-select
with a **Select all N** control, so acting on 500 bags is one click and
not 500. Deletions ask for confirmation and say what will be removed.

## What is not done yet

- **No Supabase.** Every mutation goes through `src/lib/store.tsx`, which
  is deliberately the only place data changes. Each function there maps
  to a query or mutation when the database is wired up, and the
  components calling them will not need to change.
- **State resets on refresh** for the same reason.
- Photo upload is a dropzone with no storage behind it.
- Products and parties can be viewed and searched; parties cannot be
  added from the UI yet (products can, from inside New entry).
- **Not build-tested here.** This environment has no network access, so
  `npm install` and `npm run build` could not be run. The code was
  checked by script for import resolution, unescaped apostrophes in JSX,
  unicode escape errors, brace balance, missing exports, stray
  light-theme classes and missing `"use client"` directives — the classes
  of error that break a Vercel build. Please run `npm run build` locally
  before deploying and send me any error.

## Deploying

Push to GitHub, import the repo in Vercel, deploy. Add the Supabase
variables from `.env.local.example` once the backend is connected.
