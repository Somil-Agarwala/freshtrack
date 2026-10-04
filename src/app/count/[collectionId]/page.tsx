import { Suspense } from "react";
import { CountScreen } from "@/components/count/count-screen";

export default function CountBagPage({ params }: { params: { collectionId: string } }) {
  return (
    <Suspense>
      <CountScreen collectionId={params.collectionId} />
    </Suspense>
  );
}
