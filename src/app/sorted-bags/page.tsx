import { TiedBags } from "@/components/bags/tied-bags";

// ?q= pre-fills the bag search, so a link can land on one bag.
export default function SortedBagsPage({ searchParams }: { searchParams: { q?: string } }) {
  return <TiedBags key={searchParams.q ?? ""} initialSearch={searchParams.q} />;
}
