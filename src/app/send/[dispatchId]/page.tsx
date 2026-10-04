import { SendDone } from "@/components/send/send-done";

export default function SendDonePage({ params }: { params: { dispatchId: string } }) {
  return <SendDone dispatchId={params.dispatchId} />;
}
