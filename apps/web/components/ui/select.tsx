import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClassName } from "@/components/ui/input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Native <select> styled like the other fields. Native keeps keyboard, screen
 * reader and mobile pickers working for free; `color-scheme: dark` on <html>
 * renders the option list dark.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldClassName, "flex h-9 cursor-pointer bg-background px-3 py-1", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
