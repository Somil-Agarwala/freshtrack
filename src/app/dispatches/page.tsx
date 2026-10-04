import { redirect } from "next/navigation";

// Every dispatch is listed on the Money screen; kept so old links work.
export default function Moved() {
  redirect("/money");
}
