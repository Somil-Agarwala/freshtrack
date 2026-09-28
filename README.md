# FreshTrack

Damage collection, counting, bag packing and factory claims for an FMCG
distribution business. Built as a multi-file Next.js app that drops
straight into GitHub and Vercel, with Supabase as the backend.

The app still runs on realistic sample data in `src/lib/mock-data.ts`, held
in a shared in-memory store, so a page refresh resets it. The Supabase
database (tables, security and every pipeline action) is written and tested
in `supabase/`, but is not connected yet. See "What is not done yet".

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

## The packing algorithm

`planPacking()` in `src/lib/bag-packing.ts`, and `pack_pending()` in the
Supabase migration, run the same algorithm:

```
  1. Take every count line with pending pieces (quantity - packedQuantity).
  2. Group by COMPANY + MRP. Nothing ever crosses either boundary.
  3. Inside a group, order oldest first: collection date, then collection
     bag number, then the order the SKUs were counted in.
  4. Bags needed = ceil(pieces / 700)   (or floor(...) for "full bags only").
  5. Reserve that many bag numbers at once from the forward-only counter.
  6. Pour the lines into bags in that order, 700 to a bag. A line that does
     not fit is split: part goes in this bag, the rest in the next.
  7. Record every pour as a bag content row: which collection bag, which
     SKU, how many pieces.
```

Worked example: Ganga Traders returns 900 pieces at MRP 10 on 1 March, and
Purvanchal returns 750 on 5 March. Together that is 1,650 pieces, which
makes three bags:

| Bag | Pieces | What is inside |
|---|---|---|
| CAD-M10-2026-0001 | 700 (full) | Ganga 700 |
| CAD-M10-2026-0002 | 700 (full) | Ganga 200 + Purvanchal 500 |
| CAD-M10-2026-0003 | 250 (part-filled) | Purvanchal 250 |

Why it is built this way:

- **Capacity is one constant.** `BAG_CAPACITY = 700` (and `bag_capacity()`
  in SQL). Change both together.
- **Pooling fills bags.** Pieces from different parties share a bag when
  company and MRP match, instead of each party leaving a part-filled bag.
- **Traceability is exact.** Every bag stores its contents, so the
  Traceability sheet shows exactly whose pieces are in which bag. Before,
  every bag in a tier listed every party in that tier.
- **Oldest stock goes first**, and the same input always gives the same bags.
- **Full bags only (optional).** Packs only complete 700-piece bags and
  keeps the loose remainder waiting. The next run tops it up with newer
  stock, so part-filled bags do not pile up. `packedQuantity` on each count
  line is what makes this possible: a line can be partly packed.
- **Nothing is generated blind.** The packing panel shows the split per
  tier before anything is created.

## Rules that keep the data consistent

All of these live in `src/lib/operations.ts` and again in the SQL functions:

- **Numbers only move forward.** Deleting a bag never frees its number, so
  the factory never sees one number on two different bags.
- **A count locks once any of its pieces are packed.** Delete those sorted
  bags first to change it.
- **Only ready bags can be deleted.** Their pieces go back to the packing
  queue. A dispatched bag is at the factory and leaves with its dispatch.
- **Deleting a dispatch:** one that is still open (sent or under review) is
  **cancelled**, and its bags go back to "Ready to send". A settled,
  part-settled or rejected one is **cleared**, together with its bags.
- **A collection bag cannot be deleted while a sorted bag holds its pieces**,
  so a bag never points at a party that no longer exists.
- **A dispatch holds one company's bags only.**
- **Dates are local (India) calendar days**, never UTC. The old `today()`
  used UTC, so anything logged between midnight and 5:30 AM got yesterday's
  date, and on 1 January last year's bag numbers.

## Tests

```bash
npm test            # algorithm and rules: 14 tests, incl. 3,000 random operations
npm run typecheck
npm run lint
npm run build
```

The SQL functions have their own tests in `supabase/checks/`. GitHub
Actions (`.github/workflows/ci.yml`) runs all of this, plus the migration on
a real Postgres 17, on every push.

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
│   ├── bag-packing.ts            The packing algorithm + numbering
│   ├── operations.ts             Every business rule, as pure functions
│   ├── operations.test.ts        Tests for the above
│   ├── store.tsx                 Holds the data and runs operations
│   ├── export.ts                 All Excel exports
│   ├── mock-data.ts  constants.ts  utils.ts
├── config/                       nav.ts, site.ts
└── types/index.ts                The full domain model
supabase/
├── migrations/                   Database schema, security and functions
└── checks/                       SQL tests run by CI
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
  the factory), MRP Summary (the claim total), Traceability (exactly which
  party's pieces, by SKU, are in each bag).
- **Dispatch** → dispatch summary, its bag manifest, and the same
  Traceability sheet for just that dispatch.
- **Collections** and **Records** → the current filtered view.

Every export respects whatever filters are active on screen, so filtering
by party or MRP and then exporting gives exactly that slice.

## Bulk actions

Collections, sorted bags, dispatches and records all support multi-select
with a **Select all N** control, so acting on 500 bags is one click and
not 500. Deletions ask for confirmation and say what will be removed.

## What is not done yet

- **The app is not connected to Supabase yet.** The database is fully
  written and tested (`supabase/migrations/`), but the app still runs on
  sample data in memory, so a refresh resets it and every visitor gets
  their own copy. Connecting means pointing each action in `store.tsx` at
  its database function (table below) and adding sign-in.
- Photo upload is a dropzone with no storage behind it (use Supabase
  Storage; `damage_records.photo_path` is ready for it).
- Parties cannot be added from the UI yet (products can, from New entry).
- `xlsx` 0.18.5 has published advisories (prototype pollution and ReDoS)
  that apply when *reading* untrusted spreadsheets. This app only *writes*
  them, so it is not exposed. The fixed build is only on the SheetJS CDN
  (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`); switch to it if a
  spreadsheet import is ever added.

| Store action | Supabase function |
|---|---|
| `addCollections` | `create_collections` |
| `saveCount` | `save_count` |
| `packPendingLines` / `packPendingForCompany` | `pack_pending` |
| `deleteSortedBags` | `delete_sorted_bags` |
| `createDispatch` | `create_dispatch` |
| `recordSettlement` | `record_settlement` |
| `markDispatch` | `mark_dispatch` |
| `deleteDispatches` | `delete_dispatches` |
| `deleteCollections` | `delete_collections` |
| products, companies, parties, damage records | plain table insert/update (row level security decides who may) |

## Deploying

**GitHub → Vercel** is already connected: every push to `main` deploys to
production. Work on a branch and open a pull request instead of uploading to
`main`. Vercel then builds a preview of the branch, and CI must pass before
you merge.

**Supabase**, when you are ready to connect it:

1. Create a project in **Mumbai (ap-south-1)**, the region closest to your
   users.
2. Open the SQL editor, paste in
   `supabase/migrations/20260928000000_initial_schema.sql`, and run it. With
   the Supabase CLI: `supabase link`, then `supabase db push`.
3. Sign up once in the app. Then promote yourself to admin in the SQL
   editor:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
4. Add your companies (with their short codes, e.g. `CAD`), parties and
   products in the Table Editor.
5. In Vercel → Project → Settings → Environment Variables, set
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
   Supabase → Project Settings → API. The anon key is safe in the browser:
   row level security and the database functions decide what each signed-in
   role can do, and signed-out visitors can read nothing.
