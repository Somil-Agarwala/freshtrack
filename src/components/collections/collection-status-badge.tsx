import { Badge } from "@/components/ui/badge";
import { COLLECTION_STATUS_LABELS, COLLECTION_STATUS_TONE } from "@/lib/constants";
import type { CollectionStatus } from "@/types";

export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  return <Badge tone={COLLECTION_STATUS_TONE[status]}>{COLLECTION_STATUS_LABELS[status]}</Badge>;
}
