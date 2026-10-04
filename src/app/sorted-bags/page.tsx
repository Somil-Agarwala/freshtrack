import { SortedBagsView } from "@/components/sorted-bags/sorted-bags-view";

// ?q= pre-fills the bag search, so a result from the top-bar search lands
// on that bag. Keyed so a second search from this page applies too.
export default function SortedBagsPage({ searchParams }: { searchParams: { q?: string } }) {
  return <SortedBagsView key={searchParams.q ?? ""} initialSearch={searchParams.q} />;
}
