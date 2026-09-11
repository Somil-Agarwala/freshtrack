"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionStatusBadge } from "@/components/collections/collection-status-badge";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export function RecentCollections() {
  const { collections } = useStore();
  const recent = [...collections].sort((a, b) => +new Date(b.collectedDate) - +new Date(a.collectedDate)).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent collections</CardTitle>
        <Link href="/collections" className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hi">
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-dim">No collections logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((c) => {
              const distributor = distributors.find((d) => d.id === c.distributorId);
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <Link href={`/collections/${c.id}`} className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-ink">{c.bagNumber}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {distributor?.name} · {formatDate(c.collectedDate)}
                    </p>
                  </Link>
                  <CollectionStatusBadge status={c.status} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
