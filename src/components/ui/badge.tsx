import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/constants";

// Tinted translucent fills rather than solid pastels: on a dark base a
// solid light chip glares, a 15% tint reads as a calm status marker.
const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-raised text-ink-dim",
  accent: "bg-accent/15 text-accent",
  amber: "bg-amber-500/15 text-amber-300",
  red: "bg-red-500/15 text-red-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  blue: "bg-blue-500/15 text-blue-300",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", toneStyles[tone], className)}
      {...props}
    />
  );
}
