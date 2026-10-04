"use client";

import { useMemo, useState } from "react";
import { Phone, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { pluralize } from "@/lib/utils";

export function DistributorsTable({ initialSearch = "" }: { initialSearch?: string }) {
  const { collections } = useStore();
  const [search, setSearch] = useState(initialSearch);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return distributors.filter((d) => d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parties or region" className="pl-9" />
      </div>
      <div className="rounded-xl border border-line bg-surface">
        {filtered.length === 0 ? (
          <EmptyState icon={Truck} title="No parties found" description="Try a different search term." />
        ) : (
          <>
          <ul className="divide-y divide-line md:hidden">
            {filtered.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 text-sm font-medium text-ink">{d.name}</p>
                    {!d.isActive && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-dim">
                    {d.contactName} · {d.region} · {(() => {
                      const n = collections.filter((c) => c.distributorId === d.id).length;
                      return `${n} ${pluralize(n, "collection")}`;
                    })()}
                  </p>
                </div>
                {/* Tap to call: the party is usually rung before a pickup. */}
                <a
                  href={`tel:${d.phone.replace(/\s+/g, "")}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-strong text-accent"
                  aria-label={`Call ${d.contactName}, ${d.name}`}
                >
                  <Phone className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
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
                  <TableCell className="text-ink-dim">
                    <a href={`tel:${d.phone.replace(/\s+/g, "")}`} className="hover:text-accent">{d.phone}</a>
                  </TableCell>
                  <TableCell className="text-ink-dim">{d.region}</TableCell>
                  <TableCell className="text-ink">{collections.filter((c) => c.distributorId === d.id).length}</TableCell>
                  <TableCell><Badge tone={d.isActive ? "emerald" : "neutral"}>{d.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
