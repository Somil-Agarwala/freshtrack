import { PartiesScreen } from "@/components/master/parties-screen";

export default function PartiesPage({ searchParams }: { searchParams: { q?: string } }) {
  return <PartiesScreen key={searchParams.q ?? ""} initialSearch={searchParams.q} />;
}
