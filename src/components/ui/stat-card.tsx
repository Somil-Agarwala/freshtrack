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
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <p className="text-sm text-ink-dim">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight", toneStyles[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
