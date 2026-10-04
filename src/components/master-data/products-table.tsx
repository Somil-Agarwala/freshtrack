"use client";

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export function ProductsTable({ initialSearch = "" }: { initialSearch?: string }) {
  const { products, companies } = useStore();
  const [search, setSearch] = useState(initialSearch);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or SKU" className="pl-9" />
      </div>
      <div className="rounded-xl border border-line bg-surface">
        {filtered.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Try a different search term." />
        ) : (
          <>
          <ul className="divide-y divide-line lg:hidden">
            {filtered.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{p.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-ink-faint">{p.sku}</p>
                  </div>
                  <Badge tone={p.isActive ? "emerald" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-dim">
                  <Badge tone="accent">{companies.find((c) => c.id === p.companyId)?.name}</Badge>
                  <span>MRP <span className="font-medium text-ink">{formatCurrency(p.mrp)}</span></span>
                  <span>Cost {formatCurrency(p.costPrice)}</span>
                  <span>{p.category} · {p.unit}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Cost price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs text-ink-faint">{p.sku}</TableCell>
                  <TableCell><Badge tone="accent">{companies.find((c) => c.id === p.companyId)?.name}</Badge></TableCell>
                  <TableCell className="font-medium text-ink">{p.name}</TableCell>
                  <TableCell className="text-ink-dim">{p.category}</TableCell>
                  <TableCell className="text-ink-dim">{p.unit}</TableCell>
                  <TableCell className="text-ink">{formatCurrency(p.mrp)}</TableCell>
                  <TableCell className="text-ink-dim">{formatCurrency(p.costPrice)}</TableCell>
                  <TableCell><Badge tone={p.isActive ? "emerald" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge></TableCell>
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
