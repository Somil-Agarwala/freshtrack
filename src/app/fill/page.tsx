import { Suspense } from "react";
import { FillScreen } from "@/components/fill/fill-screen";

export default function FillPage() {
  // Company, MRP and the pickup just counted come from the address bar.
  return (
    <Suspense>
      <FillScreen />
    </Suspense>
  );
}
