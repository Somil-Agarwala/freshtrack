import { Suspense } from "react";
import { PickupDone } from "@/components/pickup/pickup-done";

export default function Page() {
  // Reads the step's choices from the address bar.
  return (
    <Suspense>
      <PickupDone />
    </Suspense>
  );
}
