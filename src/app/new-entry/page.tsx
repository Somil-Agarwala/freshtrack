import { redirect } from "next/navigation";

// Moved to the godown damage screens; kept so old links still work.
export default function Moved() {
  redirect("/godown/new");
}
