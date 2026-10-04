"use client";

import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";

/** The company and party picked so far, read from the address bar so the
 *  phone's back button walks back through the steps. */
export function usePickupParams() {
  const params = useSearchParams();
  const { companies, distributors } = useStore();
  const company = companies.find((c) => c.id === params.get("company"));
  const party = distributors.find((d) => d.id === params.get("party"));
  return { company, party };
}
