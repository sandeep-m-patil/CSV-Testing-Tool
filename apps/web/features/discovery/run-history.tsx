import { History } from "lucide-react";
import { statusTone } from "@/components/ui/status-badge";
import { cn, formatDate } from "@/lib/utils";

interface RunHistoryProps {
  runs: Array<{ id: string; status: string; createdAt: string }>;
  activeId: string | null;
  onSelect: (id: string) => void;
}

const DOT: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground",
};

/** Horizontal strip of previous discovery runs; the selected run is pressed. */
export function RunHistory({ runs, activeId, onSelect }: RunHistoryProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        Runs
      </span>
      <div className="scrollbar-none flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">
        {runs.map((run) => {
          const isActive = run.id === activeId;
          return (
            <button
              key={run.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(run.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "border-brand/50 bg-brand/10 text-foreground" : "text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", DOT[statusTone(run.status)])} aria-hidden="true" />
              <span className="sr-only">{run.status}</span>
              {formatDate(run.createdAt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
