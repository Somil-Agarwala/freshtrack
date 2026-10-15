import { Suspense } from "react";
import { PartyMessageScreen } from "@/components/party/party-message-screen";

export default function PartyMessagePage() {
  // The party is read from the address bar, so back returns to the list.
  return (
    <Suspense>
      <PartyMessageScreen />
    </Suspense>
  );
}
