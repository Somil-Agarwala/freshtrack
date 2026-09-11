"use client";

import { useMemo, useState } from "react";
import { Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

export function DistributorsTable() {
  const { collections } = useStore();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return distributors.filter((d) => d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parties or region" className="pl-9" />
      </div>
      <div className="rounded-xl border border-line bg-surface">
        {filtered.length === 0 ? (
          <EmptyState icon={Truck} title="No parties found" description="Try a different search term." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Collections</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-ink">{d.name}</TableCell>
                  <TableCell className="text-ink-dim">{d.contactName}</TableCell>
                  <TableCell className="text-ink-dim">{d.phone}</TableCell>
                  <TableCell className="text-ink-dim">{d.region}</TableCell>
                  <TableCell className="text-ink">{collections.filter((c) => c.distributorId === d.id).length}</TableCell>
                  <TableCell><Badge tone={d.isActive ? "emerald" : "neutral"}>{d.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
