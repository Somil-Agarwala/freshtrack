"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PartiesScreen } from "@/components/master/parties-screen";

// Read in the browser, so the page stays static and opens instantly.
function WithQuery() {
  const q = useSearchParams().get("q") ?? undefined;
  return <PartiesScreen key={q ?? ""} initialSearch={q} />;
}

export default function PartiesPage() {
  return (
    <Suspense>
      <WithQuery />
    </Suspense>
  );
}
