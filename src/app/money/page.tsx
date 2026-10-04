import { Suspense } from "react";
import { MoneyScreen } from "@/components/money/money-screen";

export default function MoneyPage() {
  // The by-dispatch / by-party choice lives in the address bar.
  return (
    <Suspense>
      <MoneyScreen />
    </Suspense>
  );
}
