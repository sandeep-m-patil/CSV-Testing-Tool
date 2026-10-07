import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared field chrome for Input, Textarea and Select so every control looks and focuses the same. */
export const fieldClassName =
  "w-full rounded-md border border-input bg-background/60 text-sm shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-muted-foreground/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        fieldClassName,
        "flex h-9 px-3 py-1 file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldClassName, "flex min-h-[80px] px-3 py-2", className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
