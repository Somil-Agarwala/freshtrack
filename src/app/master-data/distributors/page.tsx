import { PageHeader } from "@/components/ui/page-header";
import { DistributorsTable } from "@/components/master-data/distributors-table";

export default function DistributorsPage() {
  return (
    <div>
      <PageHeader title="Parties" description="The distributors you collect damaged stock from" />
      <DistributorsTable />
    </div>
  );
}
