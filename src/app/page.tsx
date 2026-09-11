import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ClaimValueChart } from "@/components/dashboard/claim-value-chart";
import { PipelineOverview } from "@/components/dashboard/pipeline-overview";
import { ReasonBreakdownChart } from "@/components/dashboard/reason-breakdown-chart";
import { RecentCollections } from "@/components/dashboard/recent-collections";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Where everything stands across the claim pipeline"
        actions={
          <Link href="/collections" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Log collection
          </Link>
        }
      />

      <PipelineOverview />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Claim value by MRP tier</CardTitle></CardHeader>
          <CardContent><ClaimValueChart /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Own inventory loss by reason</CardTitle></CardHeader>
          <CardContent><ReasonBreakdownChart /></CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <RecentCollections />
      </div>
    </div>
  );
}
