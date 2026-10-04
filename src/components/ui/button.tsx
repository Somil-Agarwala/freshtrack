import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hi",
  secondary: "bg-raised text-ink hover:bg-line-strong",
  outline: "border border-line-strong bg-transparent text-ink hover:bg-elevated",
  ghost: "text-ink-dim hover:bg-elevated hover:text-ink",
  danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
};

// One step taller below sm, so every button on a phone is at least a
// 40-44px touch target; desktop sizes are unchanged.
const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-10 px-3 text-sm gap-1.5 sm:h-9",
  md: "h-11 px-4 text-sm gap-2 sm:h-10",
  lg: "h-12 px-5 text-base gap-2 sm:h-11",
};

export function buttonVariants(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  const { variant = "primary", size = "md", className } = opts;
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
    variantStyles[variant],
    sizeStyles[size],
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
  )
);
Button.displayName = "Button";
