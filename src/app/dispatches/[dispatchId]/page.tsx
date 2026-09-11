import { DispatchDetailView } from "@/components/dispatches/dispatch-detail-view";

export default function DispatchDetailPage({ params }: { params: { dispatchId: string } }) {
  return <DispatchDetailView dispatchId={params.dispatchId} />;
}
