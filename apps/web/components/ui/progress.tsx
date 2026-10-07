import * as React from "react";
import { cn } from "@/lib/utils";

const PERCENT = 100;

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  /** Optional classes for the filled bar, e.g. `bg-success`. */
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = PERCENT, indicatorClassName, ...props }, ref) => {
    const percent = Math.min(PERCENT, Math.max(0, (value / max) * PERCENT));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <div
          className={cn("h-full w-full flex-1 rounded-full bg-brand transition-transform duration-500", indicatorClassName)}
          style={{ transform: `translateX(-${PERCENT - percent}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
