"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buildMrpTiers } from "@/lib/bag-packing";
import { useStore } from "@/lib/store";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * The dashboard leads with the pipeline because that is the question
 * being asked most mornings: what is stuck, and where. Each stage links
 * straight to the screen that clears it.
 */
export function PipelineOverview() {
  const { collections, countLines, sortedBags, dispatches } = useStore();

  const uncounted = collections.filter((c) => c.status === "uncounted").length;
  const tiers = buildMrpTiers(countLines);
  const awaitingPack = tiers.reduce((sum, t) => sum + t.pieces, 0);
  const projectedBags = tiers.reduce((sum, t) => sum + t.totalBags, 0);
  const ready = sortedBags.filter((b) => b.status === "ready");
  const outstanding = dispatches
    .filter((d) => d.status !== "settled" && d.status !== "rejected")
    .reduce((sum, d) => sum + (d.claimedValue - (d.receivedValue ?? 0)), 0);

  const stages = [
    {
      label: "Waiting to be counted",
      value: String(uncounted),
      hint: uncounted === 1 ? "1 collection bag" : `${uncounted} collection bags`,
      href: "/collections",
    },
    {
      label: "Counted, not packed",
      value: `${formatNumber(awaitingPack)} pcs`,
      hint: projectedBags > 0 ? `Will make ${projectedBags} bags` : "Nothing pending",
      href: "/sorted-bags",
    },
    {
      label: "Ready for the factory",
      value: String(ready.length),
      hint: formatCurrency(ready.reduce((s, b) => s + b.pieceCount * b.mrp, 0)),
      href: "/sorted-bags",
    },
    {
      label: "Awaiting settlement",
      value: formatCurrency(outstanding),
      hint: "Across open dispatches",
      href: "/dispatches",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stages.map((stage) => (
        <Link
          key={stage.label}
          href={stage.href}
          className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-dim">{stage.label}</p>
            <ArrowRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-accent" />
          </div>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{stage.value}</p>
          <p className="mt-1 text-xs text-ink-faint">{stage.hint}</p>
        </Link>
      ))}
    </div>
  );
}
