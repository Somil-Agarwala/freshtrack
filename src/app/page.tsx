import { AnalyticsView } from "@/components/analytics/analytics-view";
import { LogCollectionButton } from "@/components/collections/log-collection-button";

/**
 * The dashboard is the analytics and insights view. Analytics and Reports
 * used to be separate pages; their old URLs now redirect here.
 */
export default function DashboardPage() {
  return (
    // Below lg the bottom bar's centre button already logs a collection.
    <AnalyticsView primaryAction={<LogCollectionButton size="sm" className="max-lg:hidden" />} />
  );
}
