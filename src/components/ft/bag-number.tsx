import { cn } from "@/lib/utils";

/** HLD-M10-2026-0007 → ["HLD-M10-2026-", "0007"]: the serial is what people look at. */
export function splitBagNumber(bagNumber: string): [string, string] {
  const m = bagNumber.match(/^(.*-)(\d+)$/);
  return m ? [m[1], m[2]] : ["", bagNumber];
}

/** A bag number with its serial large, as it should be written on the bag. */
export function BagNumber({ value, className }: { value: string; className?: string }) {
  const [head, serial] = splitBagNumber(value);
  return (
    <span className={cn("font-mono font-semibold leading-none tracking-[0.5px]", className)}>
      <span className="text-[0.62em] opacity-75">{head}</span>
      <span>{serial}</span>
    </span>
  );
}
