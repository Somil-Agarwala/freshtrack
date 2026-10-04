import { Suspense } from "react";
import { GodownDone } from "@/components/godown/godown-done";

export default function Page() {
  return (
    <Suspense>
      <GodownDone />
    </Suspense>
  );
}
