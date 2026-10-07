import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Secondary line under the value, e.g. "3 of 5 discovered". */
  hint?: React.ReactNode;
  className?: string;
}

/** Compact KPI tile: label + icon on top, large tabular value, optional hint. */
export function StatCard({ label, value, icon, hint, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm shadow-black/20", className)}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <p className="truncate text-xs font-medium uppercase tracking-wide">{label}</p>
        {icon ? <span className="shrink-0 [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
