import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "amber" | "red";

const toneStyles: Record<Tone, string> = {
  default: "text-ink",
  accent: "text-accent",
  amber: "text-amber-300",
  red: "text-red-300",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-line bg-surface p-3 sm:p-4", className)}>
      <p className="text-xs text-ink-dim sm:text-sm">{label}</p>
      <p className={cn("mt-1 break-words text-lg font-semibold tabular-nums tracking-tight sm:mt-1.5 sm:text-2xl", toneStyles[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
