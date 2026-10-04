import { AllBags } from "@/components/bags/all-bags";

// ?q= pre-fills the search, so a link can land on one bag.
export default function CollectionsPage({ searchParams }: { searchParams: { q?: string } }) {
  return <AllBags key={searchParams.q ?? ""} initialSearch={searchParams.q} />;
}
