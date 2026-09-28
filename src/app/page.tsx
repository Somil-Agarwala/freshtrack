import Link from "next/link";
import { Plus } from "lucide-react";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { buttonVariants } from "@/components/ui/button";

/**
 * The dashboard is the analytics and insights view. Analytics and Reports
 * used to be separate pages; their old URLs now redirect here.
 */
export default function DashboardPage() {
  return (
    <AnalyticsView
      primaryAction={
        <Link href="/collections" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" /> Log collection
        </Link>
      }
    />
  );
}
