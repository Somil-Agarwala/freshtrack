import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/constants";
import type { ResolutionStatus } from "@/types";

export function StatusBadge({ status }: { status: ResolutionStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}
