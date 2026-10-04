import type {
  CollectionStatus,
  DispatchStatus,
  ReasonCategory,
  ResolutionStatus,
  SortedBagStatus,
  SourceType,
  UserRole,
} from "@/types";

export type BadgeTone = "neutral" | "accent" | "amber" | "red" | "emerald" | "blue";

export const REASON_LABELS: Record<ReasonCategory, string> = {
  damaged_in_transit: "Damaged in transit",
  expired: "Expired",
  quality_defect: "Quality defect",
  water_damage: "Water damage",
  packaging_damage: "Packaging damage",
  returned_by_distributor: "Returned by party",
  other: "Other",
};

export const STATUS_LABELS: Record<ResolutionStatus, string> = {
  pending_review: "Pending review",
  under_investigation: "Under investigation",
  written_off: "Written off",
  returned_to_supplier: "Returned to supplier",
  disposed: "Disposed",
  resolved: "Resolved",
};

export const STATUS_TONE: Record<ResolutionStatus, BadgeTone> = {
  pending_review: "amber",
  under_investigation: "blue",
  written_off: "red",
  returned_to_supplier: "neutral",
  disposed: "red",
  resolved: "emerald",
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  own_inventory: "Own inventory",
  distributor: "Party",
};

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  uncounted: "Not counted",
  counted: "Counted",
  packed: "Packed",
};

export const COLLECTION_STATUS_TONE: Record<CollectionStatus, BadgeTone> = {
  uncounted: "amber",
  counted: "blue",
  packed: "emerald",
};

export const SORTED_BAG_STATUS_LABELS: Record<SortedBagStatus, string> = {
  ready: "Ready to send",
  dispatched: "Dispatched",
};

export const SORTED_BAG_STATUS_TONE: Record<SortedBagStatus, BadgeTone> = {
  ready: "amber",
  dispatched: "emerald",
};

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  sent: "Sent",
  under_review: "Under review",
  partially_settled: "Partially settled",
  settled: "Settled",
  rejected: "Rejected",
};

export const DISPATCH_STATUS_TONE: Record<DispatchStatus, BadgeTone> = {
  sent: "blue",
  under_review: "amber",
  partially_settled: "amber",
  settled: "emerald",
  rejected: "red",
};

/* Hindi labels for the redesigned screens; English ones above stay for exports. */
export const REASON_HI: Record<ReasonCategory, string> = {
  damaged_in_transit: "रास्ते में टूटा",
  expired: "एक्सपायर",
  quality_defect: "क्वालिटी ख़राब",
  water_damage: "पानी से ख़राब",
  packaging_damage: "पैकिंग फटी",
  returned_by_distributor: "पार्टी ने लौटाया",
  other: "कुछ और",
};

export const STATUS_HI: Record<ResolutionStatus, string> = {
  pending_review: "जाँच बाकी",
  under_investigation: "जाँच चल रही",
  written_off: "नुकसान में डाला",
  returned_to_supplier: "कंपनी को लौटाया",
  disposed: "फेंक दिया",
  resolved: "निपट गया",
};

/** Records still needing a decision; the rest are closed. */
export const OPEN_STATUSES: ResolutionStatus[] = ["pending_review", "under_investigation"];

export const COLLECTION_STATUS_HI: Record<CollectionStatus, string> = {
  uncounted: "गिनती बाकी",
  counted: "गिना, ढेर में",
  packed: "बैग में बँधा",
};

export const SORTED_BAG_STATUS_HI: Record<SortedBagStatus, string> = {
  ready: "भेजने को तैयार",
  dispatched: "फैक्ट्री भेजा",
};

export const DISPATCH_STATUS_HI: Record<DispatchStatus, string> = {
  sent: "भेजा",
  under_review: "जाँच में",
  partially_settled: "कम मिला",
  settled: "पूरा मिला",
  rejected: "मना किया",
};

export const ROLE_LABELS: Record<UserRole, { hi: string; en: string; hiDesc: string; enDesc: string }> = {
  admin: { hi: "मालिक / एडमिन", en: "Admin", hiDesc: "सब कुछ, यूज़र और सेटिंग भी", enDesc: "Full access, including users and settings" },
  manager: { hi: "मैनेजर", en: "Manager", hiDesc: "गिनती, बैग, गाड़ी और पैसा दर्ज", enDesc: "Count, tie bags, send runs and record payments" },
  data_entry: { hi: "एंट्री वाला", en: "Data entry", hiDesc: "पिकअप और गिनती दर्ज करे", enDesc: "Log pickups and count bags" },
  viewer: { hi: "सिर्फ़ देखे", en: "Viewer", hiDesc: "सब देख सकता है, बदल नहीं सकता", enDesc: "Read-only access to everything" },
};
