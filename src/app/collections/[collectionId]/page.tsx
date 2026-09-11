import { CollectionDetailView } from "@/components/collections/collection-detail-view";

export default function CollectionDetailPage({ params }: { params: { collectionId: string } }) {
  return <CollectionDetailView collectionId={params.collectionId} />;
}
