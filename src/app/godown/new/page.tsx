import { Suspense } from "react";
import { GodownEntry } from "@/components/godown/godown-entry";

export default function Page() {
  return (
    <Suspense>
      <GodownEntry />
    </Suspense>
  );
}
