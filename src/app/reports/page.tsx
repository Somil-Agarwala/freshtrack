import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PartyContribution } from "@/components/reports/party-contribution";
import { SettlementSummary } from "@/components/reports/settlement-summary";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Where the claim value comes from and how much of it comes back" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Counted value by party</CardTitle></CardHeader>
          <CardContent><PartyContribution /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Claimed vs received</CardTitle></CardHeader>
          <CardContent><SettlementSummary /></CardContent>
        </Card>
      </div>
    </div>
  );
}
