import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClassName } from "@/components/ui/input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea className={cn(fieldClassName, "flex min-h-[80px] px-3 py-2", className)} ref={ref} {...props} />;
});
Textarea.displayName = "Textarea";

export { Textarea };
