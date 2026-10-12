import { Suspense } from "react";
import { DirectEntry } from "@/components/direct/direct-entry";

export default function DirectPage() {
  // Company and party are read from the address bar, so back walks the steps.
  return (
    <Suspense>
      <DirectEntry />
    </Suspense>
  );
}
