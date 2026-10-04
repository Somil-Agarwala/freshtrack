import { OwnerDashboard } from "@/components/dashboard/owner-dashboard";
import { HomeScreen } from "@/components/home/home-screen";

/**
 * Phone: today's work for whoever is in the godown.
 * Desktop: the owner's dashboard of where the money is stuck.
 */
export default function Home() {
  return (
    <>
      <div className="lg:hidden">
        <HomeScreen />
      </div>
      <OwnerDashboard phone={false} />
    </>
  );
}
