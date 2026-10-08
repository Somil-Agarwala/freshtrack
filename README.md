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

Surfaces step up in lightness as they come forward: `canvas` → `bar` →
`surface` → `elevated` → `raised`. (The page colour is called `canvas`,
not `base`: a colour named `base` makes Tailwind's `text-base` font size
also paint the text near-black.)

Each step of the work has its own colour, used the same way on every
screen and defined in `tailwind.config.ts`: **blue = pickup**, **yellow =
count**, **purple = piles / tying bags**, **orange = factory**, **green =
money**. Fonts: Mukta for text, Baloo 2 for headings and big numbers, IBM
Plex Mono for bag numbers, all with Devanagari.

## Screens

The daily work follows the FreshTrack Redesign: big buttons, one decision
per screen, Hindi with English underneath (the हिं / EN switch swaps which
leads).

| Step | Address | What happens |
| --- | --- | --- |
| Home | `/` | Today's work, in pipeline order, with an alert for bags waiting 7+ days. On a desktop `/` is the owner dashboard. |
| 1 Pickup | `/pickup` → `/party` → `/bags` → `/done` | Company, party (search or speak), number of bags, rough pieces, photo. Done shows the bag numbers to write on each bag, with print and WhatsApp. |
| 2 Count | `/count`, `/count/[bag]` | Oldest bag first. Tap an item, type the count on the big keypad, repeat. |
| 3 Sort | `/count/[bag]/sort` | Which pile each MRP goes on, and whether a pile reached 700 so a bag can be tied. *सुनें* reads it aloud. |
| Piles | `/piles`, `/piles/tied` | Loose counted pieces per company and MRP. Ties only full 700-piece bags; leftovers stay in the pile unless packed on purpose before a factory run. |
| 4 Factory | `/send`, `/send/[run]` | One company per run, broken down by MRP, with a dispatch slip to print, save as PDF or send. |
| 5 Money | `/money` | Tracked **per dispatch**: what each run claimed and what the factory paid. *By party* splits every run back to the parties whose goods were on it, so each party has its own account (claimed, received, pending, deducted) and a WhatsApp statement. |
| Owner | `/dashboard` | Where the money is stuck, key numbers, what needs chasing, per-company table, weekly in-vs-counted, damage by party and item, claim age. |
| Godown | `/godown`, `/godown/new` | Damage and expiry of your **own** stock: company, item, how much, what happened. Loss is worked out from cost price; each entry is reviewed to a final status. Linked from home and the desktop header. |
| Records | `/collections`, `/sorted-bags`, `/dispatches/[run]` | Every pickup bag with its journey (picked up → counted → tied → sent), every tied bag with whose goods are inside, and every run with its slip, party split and payment. Excel export on each list. |
| Setup | `/master-data/*`, `/users`, `/settings`, `/more` | Companies, products and parties with add / edit sheets; users and roles; your name and language. `/more` lists everything on a phone. |

Everything else lives under **और / More**: the header menu on desktop, and
the *और सब* tile on the phone home screen. `/new-entry`, `/records` and
`/dispatches` redirect to their new homes so old links keep working.

## Accounts and who can do what

The app opens on an account page: tap your name, enter your 4-digit PIN.
The choice is remembered on that phone until someone taps *Switch user*.

| Account | Role | Starting PIN |
| --- | --- | --- |
| Nikhil | Godown in-charge | 1111 |
| Debu | Godown in-charge | 2222 |
| Somil | Admin | 0000 |

Change these after the first sign-in (Users page for the admin, Settings
for your own).

**Godown in-charge**: pickups, counting, tying bags, sending runs, godown
damage, adding a new party or item mid-task, and viewing हिसाब.
**Admin** additionally: recording factory payments, the final status of a
godown entry, deleting, companies / prices / party edits, the owner
dashboard, reports and Excel, and users and PINs. The whole split is one
table in `src/lib/access.ts`.

Every change is stamped with who made it (`loggedBy`, `countedBy`,
`tiedBy`, `sentBy`, `settledBy`), which feeds *आज टीम का काम* on the
dashboard.

PINs are checked in the browser, so they tell the app who is working; they
are not real security until sign-in moves to Supabase auth.

## Starting data

The app starts with master data only, no pickups, counts, bags, dispatches
or godown entries (`src/lib/seed-data.ts`):

- **Companies**: Cadbury, Haldirams, Unicharm, Red Bull, Lotte, Link.
- **Haldiram products and dealers** (26 items, 35 parties) from sheet
  "16082026" of `HALDIRAM_DAMAGE_CLAIM_SHEET.xlsx`, in
  `src/lib/data/haldiram.ts`. Each item carries Haldiram's claim rate.
- **Unicharm, Lotte and Red Bull products** (194, one per name and MRP)
  from the S.S. Commercial stock report `STOCK_GM.xlsx`, in
  `src/lib/data/stock-products.ts`. The report's rate is per case, so cost
  price starts at 0 and they are claimed at MRP until a claim rate is set.
- **Accounts**: Somil (admin), Nikhil and Debu.

Both data files are generated from the spreadsheets; regenerate rather
than editing by hand.

**Claim rate.** Haldiram pays its own rate per damaged piece (₹3.74 for a
₹5 Namkeen), not the MRP. A product's optional `claimRate` is fixed onto
each counted line, and every claim, bag and party share is valued with it;
products without one are claimed at MRP.

## Money per party

Bags carry no money of their own. A tied bag records how many pieces came
from each pickup (`SortedBag.contents`), oldest pickup first, the same order
the pieces leave the pile. When a run is sent, those pieces are added up per
party and fixed on the dispatch (`Dispatch.partyShares`), so the split
survives the bags being cleared out later. Whatever the factory pays for a
run is shared across its parties in proportion to their claim, and a
factory deduction is shared the same way (`splitDispatch`, `partyAccounts`
in `src/lib/pipeline.ts`).

## Mobile

- The **bottom menu** (घर, गिनती, + नया माल, ढेर, भेजो) shows on the main
  screens and hides during a focused task, where the screen's own big
  button sits at the bottom instead, clear of the home indicator.
- Every step screen keeps its address, so the phone's back button walks
  back through the steps; a half-finished count survives moving between
  the item tiles and the keypad.
- Tap targets are 44px or more, the main buttons 64px.
- Voice search (party, item) and read-aloud use the browser's speech
  features where the phone has them.
- **Installable**: *Add to Home Screen* (iOS) or *Install app* (Android,
  Chrome) opens it full screen with its own icon.

On desktop the same screens sit in a centred column under the top header,
which has one link per step coloured like the step.

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
