import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type Tone = "success" | "warning" | "destructive" | "info" | "muted";

const SUCCESS = new Set(["DISCOVERED", "COMPLETED", "PASSED", "APPROVED", "READY", "EXECUTED", "ACTIVE", "SUCCESS", "DONE"]);
const WARNING = new Set(["DISCOVERING", "RUNNING", "QUEUED", "PENDING", "DRAFT"]);
const DANGER = new Set(["FAILED", "CANCELLED", "REJECTED", "BLOCKED", "ERROR"]);
const LIVE = new Set(["DISCOVERING", "RUNNING", "QUEUED"]);

const DOT_CLASS: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground",
};

/** One mapping from any lifecycle status to a semantic colour, used by every status pill. */
export function statusTone(status: string | null | undefined): Tone {
  const key = (status ?? "").toUpperCase();
  if (SUCCESS.has(key)) return "success";
  if (WARNING.has(key)) return "warning";
  if (DANGER.has(key)) return "destructive";
  return "muted";
}

/** "NOT_DISCOVERED" -> "Not discovered". */
export function humanizeStatus(status: string | null | undefined): string {
  const text = (status ?? "unknown").replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  status: string | null | undefined;
  /** Overrides the visible text; the status still drives the colour. */
  label?: string;
}

/** Status pill with a coloured dot; the dot pulses while work is in progress. */
export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const tone = statusTone(status);
  const isLive = LIVE.has((status ?? "").toUpperCase());
  return (
    <Badge variant={tone} className={cn("pl-1.5", className)} data-status={status ?? undefined} {...props}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {isLive ? <span className={cn("absolute inset-0 animate-ping rounded-full opacity-75", DOT_CLASS[tone])} /> : null}
        <span className={cn("relative h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />
      </span>
      {label ?? humanizeStatus(status)}
    </Badge>
  );
}
