import * as React from "react";
import { cn } from "@/lib/utils";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface IconCardHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned adornment, e.g. a count badge or a small action. */
  aside?: React.ReactNode;
  className?: string;
}

/** Card header with a leading icon tile, used by every configuration card for a consistent rhythm. */
export function IconCardHeader({ icon, title, description, aside, className }: IconCardHeaderProps) {
  return (
    <CardHeader className={cn("flex-row items-start gap-3 space-y-0", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-brand [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </CardHeader>
  );
}
