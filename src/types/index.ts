export type SourceType = "own_inventory" | "distributor";

export type ReasonCategory =
  | "damaged_in_transit"
  | "expired"
  | "quality_defect"
  | "water_damage"
  | "packaging_damage"
  | "returned_by_distributor"
  | "other";

export type ResolutionStatus =
  | "pending_review"
  | "under_investigation"
  | "written_off"
  | "returned_to_supplier"
  | "disposed"
  | "resolved";

export type UserRole = "admin" | "manager" | "data_entry" | "viewer";

/**
 * A principal / brand whose damaged goods you claim against. Each company
 * settles its own claims at its own factory, so a bag and a dispatch
 * always belong to exactly one company -- they are never mixed.
 */
export interface Company {
  id: string;
  name: string;
  /** Short code used to prefix bag numbers, e.g. CAD-M10-2026-0008. */
  code: string;
  claimContact?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  /** Printed price. Sorted bags are packed by MRP tier, so this drives packing. */
  mrp: number;
  /** What the stock costs you. Drives the loss-value estimate on a record. */
  costPrice: number;
  /**
   * What the company pays per damaged piece, when it is not the MRP
   * (Haldiram pays its own rate). Leave unset to claim at MRP.
   */
  claimRate?: number;
  isActive: boolean;
}

export interface Distributor {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  region: string;
  isActive: boolean;
}

/** A free-standing damage/expiry record, logged against your own inventory. */
export interface DamageRecord {
  id: string;
  companyId: string;
  date: string;
  source: SourceType;
  distributorId?: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  reason: ReasonCategory;
  costValue: number;
  status: ResolutionStatus;
  responsibleParty: string;
  hasPhoto: boolean;
  notes?: string;
  /** User who logged the entry. */
  loggedBy?: string;
  /**
   * Pieces of own-godown damage put into the factory claim bags. Equal to
   * the quantity when it is counted in pieces or packs; cartons are turned
   * into pieces at entry; kg and litres are not bagged.
   */
  pieces?: number;
}

/* ------------------------------------------------------------------ */
/* The physical reimbursement pipeline                                 */
/*                                                                     */
/*   CollectionBag (sealed, uncounted)                                 */
/*        -> counted -> CountLine[] (SKU x quantity)                   */
/*        -> packed  -> SortedBag[] (one MRP each, tied by hand)        */
/*        -> sent    -> Dispatch (the factory run)                     */
/* ------------------------------------------------------------------ */

export type CollectionStatus = "uncounted" | "counted" | "packed";

/** What physically comes back from a party, before anyone opens it. */
export interface CollectionBag {
  id: string;
  bagNumber: string;
  /** Whose goods these are. One bag never mixes companies. */
  companyId: string;
  distributorId: string;
  collectedDate: string;
  status: CollectionStatus;
  countedDate?: string;
  /** Rough count written on the bag at pickup, before proper counting. */
  estimatedPieces?: number;
  notes?: string;
  /** Photo taken at pickup. A local object URL until storage is wired up. */
  photoUrl?: string;
  /** User who logged the pickup, and who counted it. */
  loggedBy?: string;
  countedBy?: string;
  /**
   * Entered straight from a count sheet ("Add counted goods"): the goods
   * were already counted, so there was no separate pickup step.
   */
  direct?: boolean;
  /** The day the party was sent the WhatsApp summary of what was received. */
  partyNotified?: string;
}

/** One counted SKU line inside a collection bag. */
export interface CountLine {
  id: string;
  collectionId: string;
  /** Copied from the parent bag so packing can group without a join. */
  companyId: string;
  productId: string;
  /** Snapshotted at count time so later MRP changes cannot rewrite history. */
  mrp: number;
  quantity: number;
  /** Claim rate per piece, snapshotted at count time like the MRP. Unset = MRP. */
  rate?: number;
  /** Set once these pieces have been put into a numbered bag. */
  packed: boolean;
  /**
   * Set when these pieces are damage in our own godown (a godown entry)
   * rather than goods picked up from a party. collectionId is then
   * "godown:<record id>" and there is no party.
   */
  recordId?: string;
  /**
   * The numbered bag these pieces were put into, decided the moment the
   * count is saved. A line that fills one bag and spills into the next is
   * split into one line per bag.
   */
  bagId?: string;
}

/**
 * open: being filled in the godown (no piece limit);
 * ready: tied by a manager when full, waiting for the factory;
 * dispatched: gone to the factory.
 */
export type SortedBagStatus = "open" | "ready" | "dispatched";

/**
 * A packed bag destined for the factory. Holds exactly one MRP tier and
 * at most CAPACITY pieces -- pieces from different SKUs share a bag as
 * long as the printed price matches.
 */
export interface SortedBag {
  id: string;
  bagNumber: string;
  companyId: string;
  mrp: number;
  pieceCount: number;
  /** True once tied (ready or sent); false while still being filled. */
  isFull: boolean;
  createdDate: string;
  status: SortedBagStatus;
  dispatchId?: string;
  /** Collection bags whose pieces ended up in here, for traceability. */
  sourceCollectionIds: string[];
  /**
   * How many of the pieces came from each pickup. A bag pools pieces from
   * several parties, and this is what lets a dispatch's money be split
   * back to the parties fairly. Missing on old rows, which fall back to
   * splitting by sourceCollectionIds.
   */
  contents?: BagContent[];
  /**
   * Which items are in the bag and how many pieces of each, recorded when
   * the bag is tied. This is what the factory invoice lists bag by bag.
   * Missing on bags tied before items were recorded.
   */
  items?: BagItem[];
  /** User who tied the bag, and the day. */
  tiedBy?: string;
  tiedDate?: string;
  /** Claim value of the bag at the pieces' claim rates. Unset = pieces × MRP. */
  claimValue?: number;
  /**
   * Pieces in the bag that were damaged in our own godown, and their claim
   * value. Kept apart from `contents`, which is the parties' goods only.
   */
  own?: { pieces: number; value: number };
  /** The pickup (or "godown:<record id>") whose pieces opened this bag, so its screen can say "new bag". */
  openedFor?: string;
  /** Old data only: closed part-filled before a factory run (from when bags held 700). */
  closedEarly?: boolean;
}

/** Pieces of one item inside a tied bag. */
export interface BagItem {
  productId: string;
  pieces: number;
}

export interface BagContent {
  collectionId: string;
  pieces: number;
  /** Claim value of those pieces, at their counted rate. */
  value?: number;
}

/** One party's part of a dispatch: its pieces and what they claim. */
export interface PartyShare {
  distributorId: string;
  pieces: number;
  value: number;
}

export type DispatchStatus = "sent" | "under_review" | "partially_settled" | "settled" | "rejected";

/** One physical run to the factory carrying many sorted bags. */
export interface Dispatch {
  id: string;
  dispatchNumber: string;
  /** A dispatch goes to one company's factory, so it is single-company. */
  companyId: string;
  sentDate: string;
  bagCount: number;
  pieceCount: number;
  claimedValue: number;
  receivedValue?: number;
  status: DispatchStatus;
  settledDate?: string;
  notes?: string;
  /**
   * Whose goods were on this run, fixed when it is sent. Money is tracked
   * per dispatch; what the factory pays is split across these shares in
   * proportion to their claim, which gives each party's account.
   */
  partyShares?: PartyShare[];
  /** User who sent the run, and who recorded the factory's payment. */
  sentBy?: string;
  settledBy?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  /** The email this person signs in with; it links their login to this record. */
  email: string;
  role: UserRole;
  isActive: boolean;
  lastActive: string;
  /** Old 4-digit PIN from before email logins. No longer used. */
  pin?: string;
}
