"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/constants";
import type { Insight, InsightLevel } from "@/lib/analytics";

// Every level carries a word as well as a colour, so urgency never
// depends on colour alone.
const LEVEL: Record<InsightLevel, { label: string; tone: BadgeTone }> = {
  critical: { label: "Act now", tone: "red" },
  warning: { label: "Watch", tone: "amber" },
  info: { label: "FYI", tone: "blue" },
  good: { label: "All clear", tone: "emerald" },
};

export function InsightList({ items, limit }: { items: Insight[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="divide-y divide-line">
      {shown.map((item, i) => (
        <li key={`${item.title}-${i}`}>
          <Link href={item.href} className="group flex items-start gap-3 py-3">
            <Badge tone={LEVEL[item.level].tone} className="mt-0.5 shrink-0">
              {LEVEL[item.level].label}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.title}</p>
              <p className="mt-0.5 text-xs text-ink-dim">{item.detail}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
