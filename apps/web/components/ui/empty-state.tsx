import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** `compact` fits inside a card; the default fills a page section. */
  size?: "default" | "compact";
  className?: string;
}

/** Dashed placeholder for a list or section with nothing in it yet, with an optional next step. */
export function EmptyState({ icon, title, description, action, size = "default", className }: EmptyStateProps) {
  const isCompact = size === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 text-center",
        isCompact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full border bg-muted/60 text-muted-foreground",
            isCompact ? "h-9 w-9 [&_svg]:size-4" : "h-12 w-12 [&_svg]:size-5",
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="max-w-md space-y-1">
        <p className={cn("font-medium text-foreground", isCompact ? "text-sm" : "text-base")}>{title}</p>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
