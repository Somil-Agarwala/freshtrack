import { Suspense } from "react";
import { GodownList } from "@/components/godown/godown-list";

export default function Page() {
  return (
    <Suspense>
      <GodownList />
    </Suspense>
  );
}
