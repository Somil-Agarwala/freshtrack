import { PageHeader } from "@/components/ui/page-header";
import { DistributorsTable } from "@/components/master-data/distributors-table";

export default function DistributorsPage({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <div>
      <PageHeader title="Parties" description="The distributors you collect damaged stock from" />
      <DistributorsTable key={searchParams.q ?? ""} initialSearch={searchParams.q} />
    </div>
  );
}
