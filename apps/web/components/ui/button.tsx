import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // The focus ring uses the brand-tinted `ring` token with a background offset so
  // it stays visible on every dark surface (page, card, dialog).
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/85",
        brand: "bg-brand text-brand-foreground shadow-sm hover:bg-brand/85",
        destructive:
          "bg-destructive-emphasis text-destructive-foreground shadow-sm hover:bg-destructive-emphasis/85 focus-visible:ring-destructive",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/85 focus-visible:ring-success",
        warning: "bg-warning text-warning-foreground shadow-sm hover:bg-warning/85 focus-visible:ring-warning",
        outline:
          "border border-input bg-transparent shadow-sm hover:border-muted-foreground/40 hover:bg-accent hover:text-accent-foreground",
        secondary: "border border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        dangerGhost: "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        // 44px is the minimum comfortable touch target on a phone.
        touch: "h-11 px-5 py-2.5",
        icon: "h-9 w-9",
        iconSm: "h-8 w-8",
        iconTouch: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
