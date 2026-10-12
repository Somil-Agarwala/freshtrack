"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TiedBags } from "@/components/bags/tied-bags";

// ?q= pre-fills the bag search, so a link can land on one bag.
// Read in the browser, so the page stays static and opens instantly.
function WithQuery() {
  const q = useSearchParams().get("q") ?? undefined;
  return <TiedBags key={q ?? ""} initialSearch={q} />;
}

export default function SortedBagsPage() {
  return (
    <Suspense>
      <WithQuery />
    </Suspense>
  );
}
