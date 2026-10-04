import { Suspense } from "react";
import { PickupParty } from "@/components/pickup/pickup-party";

export default function Page() {
  // Reads the step's choices from the address bar.
  return (
    <Suspense>
      <PickupParty />
    </Suspense>
  );
}
