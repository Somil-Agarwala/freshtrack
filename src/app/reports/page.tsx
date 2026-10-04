import { redirect } from "next/navigation";

// Reports live on the detailed reports page. Kept as a redirect so
// bookmarks and old links still land somewhere useful.
export default function MovedToAnalytics() {
  redirect("/analytics");
}
