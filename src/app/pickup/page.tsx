import { Suspense } from "react";
import { PickupCompany } from "@/components/pickup/pickup-company";

export default function Page() {
  // Reads the step's choices from the address bar.
  return (
    <Suspense>
      <PickupCompany />
    </Suspense>
  );
}
