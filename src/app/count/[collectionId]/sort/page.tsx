import { SortGuide } from "@/components/count/sort-guide";

export default function SortPage({ params }: { params: { collectionId: string } }) {
  return <SortGuide collectionId={params.collectionId} />;
}
