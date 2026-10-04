"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ChartIcon } from "@/components/ft/icons";
import { Chips, ExportButton } from "@/components/ft/kit";
import { CompanyTabs, ListHeader } from "@/components/ft/screen";
import { useStore } from "@/lib/store";
import * as A from "@/lib/analytics";
import { exportAnalytics } from "@/lib/export";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { DataTable, Metric, Panel, RankedBars } from "./primitives";
import { MagnitudeBars, PairedBars, SmallMultiples, TrendLines } from "./charts";
import { InsightList } from "./insight-list";

const TABS = ["Overview", "Insights", "Claims", "Parties", "Products", "Operations", "Own inventory"] as const;
type Tab = (typeof TABS)[number];
const TAB_HI: Record<Tab, string> = {
  Overview: "सारांश",
  Insights: "ध्यान दें",
  Claims: "क्लेम",
  Parties: "पार्टियाँ",
  Products: "सामान",
  Operations: "काम की रफ़्तार",
  "Own inventory": "गोदाम नुकसान",
};

export function AnalyticsView({
  title = "Dashboard",
  description = "Where everything stands, and what needs attention",
  primaryAction,
}: {
  title?: string;
  description?: string;
  /** Rendered after the export buttons, e.g. a "Log collection" link. */
  primaryAction?: ReactNode;
}) {
  const store = useStore();
  const { t: lt } = useLang();
  const [tab, setTab] = useState<Tab>("Overview");
  const [companyId, setCompanyId] = useState<string>("all");
  const [showTables, setShowTables] = useState(false);
  // Seven tabs do not fit a phone; the row scrolls sideways. Keep the
  // chosen tab in view and fade the edge while there is more to swipe to.
  const tabRow = useRef<HTMLDivElement>(null);
  const [moreTabs, setMoreTabs] = useState(false);
  function checkTabOverflow() {
    const el = tabRow.current;
    if (el) setMoreTabs(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }
  useEffect(() => {
    tabRow.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    checkTabOverflow();
  }, [tab]);

  const dataset: A.Dataset = useMemo(
    () => ({
      companies: store.companies,
      products: store.products,
      distributors: store.distributors,
      collections: store.collections,
      countLines: store.countLines,
      sortedBags: store.sortedBags,
      dispatches: store.dispatches,
      records: store.records,
    }),
    [store]
  );

  // Every section reads the scoped dataset, so the company filter applies
  // uniformly and nothing silently ignores it.
  const d = useMemo(() => A.scopeToCompany(dataset, companyId), [dataset, companyId]);

  const pipeline = useMemo(() => A.pipeline(d), [d]);
  const recovery = useMemo(() => A.recoveryHeadline(d), [d]);
  const trend = useMemo(() => A.monthlyTrend(d), [d]);
  const claims = useMemo(() => A.claimsByCompany(d), [d]);
  const parties = useMemo(() => A.partyBreakdown(d), [d]);
  const regions = useMemo(() => A.regionBreakdown(d), [d]);
  const skus = useMemo(() => A.topSkus(d), [d]);
  const cats = useMemo(() => A.categoryBreakdown(d), [d]);
  const mrp = useMemo(() => A.mrpBreakdown(d), [d]);
  const fill = useMemo(() => A.bagFill(d), [d]);
  const turnaround = useMemo(() => A.countTurnaround(d), [d]);
  const accuracy = useMemo(() => A.countAccuracy(d), [d]);
  const backlog = useMemo(() => A.countingBacklog(d), [d]);
  const byReason = useMemo(() => A.ownLossByReason(d), [d]);
  const byResponsible = useMemo(() => A.ownLossByResponsible(d), [d]);
  const findings = useMemo(() => A.insights(d), [d]);
  const urgent = findings.filter((f) => f.level === "critical" || f.level === "warning").length;

  return (
    <div className="mx-auto w-full max-w-[1360px] pb-8">
      <ListHeader tone="neutral" icon={<ChartIcon size={26} />} title={lt(title === "Dashboard" ? "विस्तृत रिपोर्ट" : "विस्तृत रिपोर्ट", title)} subtitle={lt("हर क्लेम, पार्टी, सामान और गिनती — Excel के साथ", description)}>
        <CompanyTabs companies={store.companies} value={companyId} onChange={setCompanyId} tone="count" all={lt("सब कंपनी", "All")} />
      </ListHeader>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-2 lg:pt-4">
        <div className="flex flex-wrap gap-2">
          <ExportButton onClick={() => exportAnalytics(d)} />
          <button
            type="button"
            onClick={() => setShowTables((s) => !s)}
            aria-pressed={showTables}
            className="flex h-12 items-center gap-1.5 rounded-[14px] bg-elevated px-3 text-[15px] font-bold text-ink-dim hover:bg-raised hover:text-ink"
          >
            {showTables ? lt("तालिका छिपाएँ", "Hide tables") : lt("तालिका दिखाएँ", "Show tables")}
          </button>
          {primaryAction}
        </div>
        <div ref={tabRow} onScroll={checkTabOverflow} className={moreTabs ? "[mask-image:linear-gradient(to_right,black_85%,transparent)]" : ""}>
          <Chips
            label="Section"
            value={tab}
            onChange={setTab}
            options={TABS.map((x) => ({
              value: x,
              label: (
                <>
                  {lt(TAB_HI[x], x)}
                  {x === "Insights" && urgent > 0 && <span className="rounded-full bg-danger-tint px-1.5 text-xs text-danger-soft">{urgent}</span>}
                </>
              ),
            }))}
          />
        </div>

      {tab === "Overview" && (
        <div className="space-y-4">
          <Panel
            title="What needs attention"
            hint={urgent > 0 ? `${urgent} finding${urgent === 1 ? "" : "s"} to act on or watch.` : "The most important findings right now."}
          >
            <InsightList items={findings} limit={3} />
            {findings.length > 3 && (
              <button onClick={() => setTab("Insights")} className="mt-2 text-sm font-medium text-accent hover:text-accent-hi">
                See all {findings.length} insights
              </button>
            )}
          </Panel>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Claimed all time" value={formatCurrency(recovery.claimedAllTime)} />
            <Metric label="Received" value={formatCurrency(recovery.received)} tone="good" />
            <Metric
              label="Shortfall on settled"
              value={formatCurrency(recovery.shortfall)}
              tone={recovery.shortfall > 0 ? "warning" : "default"}
            />
            <Metric
              label="Awaiting settlement"
              value={formatCurrency(recovery.openValue)}
              hint={`${recovery.openCount} open dispatch${recovery.openCount === 1 ? "" : "es"}`}
              tone={recovery.openCount > 0 ? "warning" : "default"}
            />
          </div>

          <Panel title="Pipeline" hint="Where stock and value are sitting right now. Each row links to the screen that clears it.">
            <ul className="divide-y divide-line">
              {pipeline.map((s) => (
                <li key={s.stage}>
                  <Link href={s.href} className="group flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{s.stage}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {s.bags} {s.bags === 1 ? "bag" : "bags"} · {formatNumber(s.pieces)} pcs
                        {s.value > 0 && ` · ${formatCurrency(s.value)}`}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Claimed vs received by month" hint="Both in rupees, so one shared scale.">
              <TrendLines data={trend} lines={[{ key: "claimed", label: "Claimed" }, { key: "received", label: "Received" }]} money />
            </Panel>
            <Panel title="Pieces counted by month">
              <MagnitudeBars data={trend} xKey="month" valueKey="countedPieces" />
            </Panel>
          </div>


          {showTables && (
            <Panel title="Monthly figures">
              <DataTable
                head={["Month", "Bags collected", "Pieces counted", "Claimed", "Received"]}
                rows={trend.map((t) => [t.month, t.collectedBags, formatNumber(t.countedPieces), formatCurrency(t.claimed), formatCurrency(t.received)])}
              />
            </Panel>
          )}
        </div>
      )}

      {tab === "Insights" && (
        <Panel title="Insights" hint="Plain-language findings from the numbers on every other tab, most urgent first. Each links to where it can be acted on.">
          <InsightList items={findings} />
        </Panel>
      )}

      {tab === "Claims" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric
              label="Recovery rate"
              value={`${recovery.recoveryPct.toFixed(1)}%`}
              hint="Of settled claims only"
              tone={recovery.recoveryPct >= 95 ? "good" : recovery.recoveryPct >= 85 ? "warning" : "critical"}
            />
            <Metric label="Shortfall" value={formatCurrency(recovery.shortfall)} tone={recovery.shortfall > 0 ? "warning" : "good"} />
            <Metric label="Open claims" value={String(recovery.openCount)} hint={formatCurrency(recovery.openValue)} />
            <Metric label="Companies claiming" value={String(claims.length)} />
          </div>

          <Panel title="Claimed vs received by company" hint="Settled claims only. A gap is money the factory did not pay.">
            <PairedBars data={claims} xKey="company" aKey="claimed" bKey="received" aLabel="Claimed" bLabel="Received" />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Recovery rate by company" hint="Higher is better. Below 100% means short payments.">
              <RankedBars
                rows={claims.map((c) => ({ label: c.company, value: Math.round(c.recoveryPct) }))}
                format={(v) => `${v}%`}
              />
            </Panel>
            <Panel title="Settlement speed" hint="Mean days from dispatch to money received.">
              <RankedBars
                rows={claims.filter((c) => c.avgSettlementDays != null).map((c) => ({
                  label: c.company,
                  value: c.avgSettlementDays as number,
                }))}
                format={(v) => `${v} days`}
              />
            </Panel>
          </div>

          <Panel title="Claim detail by company">
            <DataTable
              head={["Company", "Dispatches", "Claimed", "Received", "Shortfall", "Recovery", "Avg days"]}
              rows={claims.map((c) => [
                c.company,
                c.dispatches,
                formatCurrency(c.claimed),
                formatCurrency(c.received),
                formatCurrency(c.shortfall),
                `${c.recoveryPct.toFixed(1)}%`,
                c.avgSettlementDays ?? "—",
              ])}
            />
          </Panel>
        </div>
      )}

      {tab === "Parties" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Parties returning stock" value={String(parties.length)} />
            <Metric label="Regions" value={String(regions.length)} />
            <Metric
              label="Total counted value"
              value={formatCurrency(parties.reduce((s, p) => s + p.value, 0))}
            />
            <Metric
              label="Rough-count error"
              value={`${accuracy.meanAbsPct.toFixed(1)}%`}
              hint="Mean gap between pickup estimate and real count"
              tone={accuracy.meanAbsPct > 15 ? "warning" : "good"}
            />
          </div>

          <Panel title="Counted value by party" hint="Whose returns make up the claim.">
            <RankedBars
              rows={parties.map((p) => ({ label: p.party, value: p.value, sub: `${p.sharePct.toFixed(0)}%` }))}
              format={formatCurrency}
              sequential
            />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Value by region">
              <RankedBars rows={regions.map((r) => ({ label: r.region, value: r.value }))} format={formatCurrency} />
            </Panel>
            <Panel title="Pieces by party">
              <RankedBars rows={parties.map((p) => ({ label: p.party, value: p.pieces }))} format={formatNumber} />
            </Panel>
          </div>

          <Panel title="Party detail" hint="Count variance compares the rough count at pickup with the real count. Negative means the bag came up short.">
            <DataTable
              head={["Party", "Region", "Bags", "Pieces", "Value", "Share", "Count variance"]}
              rows={parties.map((p) => [
                p.party,
                p.region,
                p.bags,
                formatNumber(p.pieces),
                formatCurrency(p.value),
                `${p.sharePct.toFixed(1)}%`,
                p.countVariancePct == null ? "—" : `${p.countVariancePct > 0 ? "+" : ""}${p.countVariancePct.toFixed(1)}%`,
              ])}
            />
          </Panel>
        </div>
      )}

      {tab === "Products" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="SKUs seen in returns" value={String(skus.length)} />
            <Metric label="Categories" value={String(cats.length)} />
            <Metric label="MRP tiers" value={String(mrp.length)} />
            <Metric label="Pieces counted" value={formatNumber(mrp.reduce((s, m) => s + m.pieces, 0))} />
          </div>

          <Panel title="Top SKUs by value" hint="The products costing you the most in returns.">
            <RankedBars
              rows={skus.map((s) => ({ label: s.name, value: s.value, sub: s.sku }))}
              format={formatCurrency}
              sequential
            />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Value by category">
              <RankedBars rows={cats.map((c) => ({ label: c.category, value: c.value }))} format={formatCurrency} />
            </Panel>
            <Panel title="Pieces by MRP tier" hint="The shape of the claim: which tiers fill bags.">
              <MagnitudeBars data={mrp} xKey="label" valueKey="pieces" sequential />
            </Panel>
          </div>

          <Panel title="MRP tier detail">
            <DataTable
              head={["Tier", "Pieces", "Bags packed", "Value"]}
              rows={mrp.map((m) => [m.label, formatNumber(m.pieces), m.bags, formatCurrency(m.value)])}
            />
          </Panel>
        </div>
      )}

      {tab === "Operations" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Bags packed" value={String(fill.bags)} />
            <Metric
              label="Average fill"
              value={`${fill.avgFillPct.toFixed(0)}%`}
              hint={`Capacity is ${formatNumber(700)} per bag`}
              tone={fill.avgFillPct >= 90 ? "good" : fill.avgFillPct >= 70 ? "warning" : "critical"}
            />
            <Metric label="Part-filled bags" value={String(fill.partial)} hint={`${fill.full} full`} />
            <Metric
              label="Unused capacity"
              value={`${formatNumber(fill.wastedPieces)} pcs`}
              hint="Space paid for but not filled"
              tone={fill.wastedPieces > 700 ? "warning" : "default"}
            />
          </div>

          <Panel title="Counting backlog" hint="Uncounted bags by how long they have been waiting. Anything in 15+ days is stock you cannot claim yet.">
            <MagnitudeBars data={backlog} xKey="label" valueKey="bags" />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Count turnaround by company" hint="Mean days from pickup to counted.">
              <RankedBars
                rows={turnaround.filter((t) => t.avgDays != null).map((t) => ({ label: t.company, value: t.avgDays as number }))}
                format={(v) => `${v} days`}
              />
            </Panel>
            <Panel title="Oldest uncounted bag" hint="Per company, in days waiting.">
              <RankedBars
                rows={turnaround
                  .filter((t) => t.oldestPendingDays != null)
                  .map((t) => ({ label: t.company, value: t.oldestPendingDays as number }))}
                format={(v) => `${v} days`}
              />
            </Panel>
          </div>

          <Panel title="Rough count vs real count" hint="Biggest gaps first. A consistent negative gap on one party is worth a conversation.">
            <DataTable
              head={["Bag", "Estimated", "Counted", "Gap", "Gap %"]}
              rows={accuracy.rows.slice(0, 12).map((r) => [
                r.bagNumber,
                formatNumber(r.estimated),
                formatNumber(r.actual),
                `${r.variance > 0 ? "+" : ""}${formatNumber(r.variance)}`,
                `${r.variancePct > 0 ? "+" : ""}${r.variancePct.toFixed(1)}%`,
              ])}
            />
          </Panel>
        </div>
      )}

      {tab === "Own inventory" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Records logged" value={String(d.records.length)} />
            <Metric label="Total loss value" value={formatCurrency(d.records.reduce((s, r) => s + r.costValue, 0))} tone="critical" />
            <Metric label="Units affected" value={formatNumber(d.records.reduce((s, r) => s + r.quantity, 0))} />
            <Metric
              label="Pending resolution"
              value={String(d.records.filter((r) => r.status === "pending_review" || r.status === "under_investigation").length)}
              tone="warning"
            />
          </div>

          <Panel title="Loss by reason" hint="At cost price, not MRP -- this is your own stock, not a claim.">
            <RankedBars rows={byReason.map((r) => ({ label: r.reason, value: r.value }))} format={formatCurrency} sequential />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Loss by responsible party">
              <RankedBars rows={byResponsible.map((r) => ({ label: r.party, value: r.value }))} format={formatCurrency} />
            </Panel>
            <Panel title="Units by reason">
              <RankedBars rows={byReason.map((r) => ({ label: r.reason, value: r.qty }))} format={formatNumber} />
            </Panel>
          </div>

          {companyId === "all" && store.companies.length > 1 && (
            <Panel title="Loss by reason, per company" hint="Small multiples on a shared scale, so panels are directly comparable.">
              <SmallMultiples
                money
                panels={store.companies
                  .map((co) => {
                    const scoped = A.scopeToCompany(dataset, co.id);
                    return { label: co.name, data: A.ownLossByReason(scoped), xKey: "reason" as const, valueKey: "value" as const };
                  })
                  .filter((p) => p.data.length > 0)}
              />
            </Panel>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
