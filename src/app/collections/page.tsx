"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AllBags } from "@/components/bags/all-bags";

// ?q= pre-fills the search, so a link can land on one bag.
// Read in the browser, so the page stays static and opens instantly.
function WithQuery() {
  const q = useSearchParams().get("q") ?? undefined;
  return <AllBags key={q ?? ""} initialSearch={q} />;
}

export default function CollectionsPage() {
  return (
    <Suspense>
      <WithQuery />
    </Suspense>
  );
}
