import { Suspense } from "react";
import { PickupBags } from "@/components/pickup/pickup-bags";

export default function Page() {
  // Reads the step's choices from the address bar.
  return (
    <Suspense>
      <PickupBags />
    </Suspense>
  );
}
