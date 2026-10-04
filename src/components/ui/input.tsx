import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

// On phones: 16px text, because iOS zooms the whole page into any field
// smaller than that, and 44px height for a comfortable tap. Number fields
// open the digit keypad rather than the full keyboard; pass
// inputMode="decimal" where paise are allowed.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, inputMode, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      inputMode={inputMode ?? (type === "number" ? "numeric" : undefined)}
      className={cn(
        "flex h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
