import { PageHeader } from "@/components/ui/page-header";
import { ProductsTable } from "@/components/master-data/products-table";

export default function ProductsPage({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <div>
      <PageHeader
        title="Products"
        description="MRP drives how bags are packed, cost price drives loss value"
      />
      <ProductsTable key={searchParams.q ?? ""} initialSearch={searchParams.q} />
    </div>
  );
}
