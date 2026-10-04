"use client";

import { OwnerDashboard } from "@/components/dashboard/owner-dashboard";
import { HomeScreen } from "@/components/home/home-screen";
import { useSession } from "@/lib/session";

/**
 * Phone: today's work for whoever is in the godown.
 * Desktop: the owner's dashboard for the admin, today's work for the team.
 */
export default function Home() {
  const { can } = useSession();
  if (!can("ownerView")) return <HomeScreen />;
  return (
    <>
      <div className="lg:hidden">
        <HomeScreen />
      </div>
      <OwnerDashboard phone={false} />
    </>
  );
}
