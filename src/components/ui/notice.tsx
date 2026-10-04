import { CheckCircle2 } from "lucide-react";

// A toast pinned just under the top bar. It used to be a line at the top
// of the page, which scrolled out of sight after acting on something at
// the bottom of a long list -- the usual case on a phone. Top rather than
// bottom so it never covers the selection bar or the bottom navigation.
export function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4 lg:top-[84px]"
    >
      <div className="pointer-events-auto flex max-w-lg items-start gap-2 rounded-lg border border-money-line bg-money-tint px-4 py-3 text-[15px] font-semibold text-money-note shadow-lg">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
