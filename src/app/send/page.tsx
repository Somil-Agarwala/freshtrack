import { Suspense } from "react";
import { SendFactory } from "@/components/send/send-factory";

export default function SendPage() {
  return (
    <Suspense>
      <SendFactory />
    </Suspense>
  );
}
