import { Suspense } from "react";
import { BagTied } from "@/components/piles/bag-tied";

export default function BagTiedPage() {
  return (
    <Suspense>
      <BagTied />
    </Suspense>
  );
}
