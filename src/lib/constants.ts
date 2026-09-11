import type {
  CollectionStatus,
  DispatchStatus,
  ReasonCategory,
  ResolutionStatus,
  SortedBagStatus,
  SourceType,
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
