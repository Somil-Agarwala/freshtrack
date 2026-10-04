"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Company and period chosen for the owner dashboard. Held above the page
 * because on a desktop the pickers sit in the top header, outside it.
 */
export type Period = "month" | "90d";

interface Filters {
  companyId: string;
  setCompanyId: (id: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
}

const FiltersContext = createContext<Filters | null>(null);

export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyId] = useState("all");
  const [period, setPeriod] = useState<Period>("month");
  return <FiltersContext.Provider value={{ companyId, setCompanyId, period, setPeriod }}>{children}</FiltersContext.Provider>;
}

export function useDashboardFilters() {
  const value = useContext(FiltersContext);
  if (!value) throw new Error("useDashboardFilters must be used inside DashboardFiltersProvider");
  return value;
}
