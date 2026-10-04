import { RunDetail } from "@/components/money/run-detail";

export default function DispatchPage({ params }: { params: { dispatchId: string } }) {
  return <RunDetail dispatchId={params.dispatchId} />;
}
