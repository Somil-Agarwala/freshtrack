import { BagDetail } from "@/components/bags/bag-detail";

export default function CollectionDetailPage({ params }: { params: { collectionId: string } }) {
  return <BagDetail collectionId={params.collectionId} />;
}
