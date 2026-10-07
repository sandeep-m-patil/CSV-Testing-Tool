import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Heading level; sections inside a page default to h2. */
  as?: "h2" | "h3";
  className?: string;
}

/** Heading row for a section within a page (below the PageHeader). */
export function SectionHeader({ title, description, actions, as: Heading = "h2", className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <Heading className="text-base font-semibold tracking-tight">{title}</Heading>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
