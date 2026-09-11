import { PageHeader } from "@/components/ui/page-header";
import { NewEntryForm } from "@/components/new-entry/new-entry-form";

export default function NewEntryPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="New entry" description="Log damage or expiry against your own inventory" />
      <NewEntryForm />
    </div>
  );
}
