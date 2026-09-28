import { redirect } from "next/navigation";

// This page moved onto the dashboard. Kept as a redirect so bookmarks and
// old links still land somewhere useful.
export default function MovedToDashboard() {
  redirect("/");
}
