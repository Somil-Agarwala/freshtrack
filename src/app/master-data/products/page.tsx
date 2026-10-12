"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductsScreen } from "@/components/master/products-screen";

// Read in the browser, so the page stays static and opens instantly.
function WithQuery() {
  const q = useSearchParams().get("q") ?? undefined;
  return <ProductsScreen key={q ?? ""} initialSearch={q} />;
}

export default function ProductsPage() {
  return (
    <Suspense>
      <WithQuery />
    </Suspense>
  );
}
