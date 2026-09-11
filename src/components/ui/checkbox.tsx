import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

// Kept visually small (16px); every usage wraps it in a >=40px tappable
// label so the touch target is comfortable without an oversized box.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn("h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong bg-elevated accent-teal-400 focus:ring-2 focus:ring-accent/30", className)}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";
