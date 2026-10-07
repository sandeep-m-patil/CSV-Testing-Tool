import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Semantic colours are fixed across the app: success = done / passed,
 * warning = running / pending / draft, destructive = failed / rejected /
 * production, info = roles / AI / assertions, muted = neutral metadata.
 */
const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium leading-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        outline: "border-border text-foreground",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        info: "border-info/30 bg-info/10 text-info",
        muted: "border-border bg-muted/60 text-muted-foreground",
        brand: "border-brand/30 bg-brand/10 text-brand",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
