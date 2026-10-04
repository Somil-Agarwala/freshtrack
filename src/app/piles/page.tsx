import { Suspense } from "react";
import { PilesBoard } from "@/components/piles/piles-board";

export default function PilesPage() {
  return (
    <Suspense>
      <PilesBoard />
    </Suspense>
  );
}
