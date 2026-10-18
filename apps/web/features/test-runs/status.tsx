"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, HelpCircle, MinusCircle, ServerCrash, XCircle } from "lucide-react";
import { RESULT_STATUSES, type ResultStatus } from "@repo/schemas";
import { Badge } from "@/components/ui/badge";

export const STATUS_FILTERS = ["ALL", ...RESULT_STATUSES] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type { ResultStatus };

/** Plain-language label for each result status. */
export const STATUS_LABELS: Record<ResultStatus, string> = {
  PASS: "Passed",
  FAIL: "Failed",
  BLOCKED: "Blocked",
  SKIP: "Skipped",
  INFRA_ERROR: "Infrastructure error",
  FLAKY: "Flaky",
};

export function passRate(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
}

export function StatusIcon({ status }: { status: string }) {
  if (status === "PASS") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "FAIL") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "BLOCKED") return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  if (status === "SKIP") return <CircleSlash className="h-4 w-4 text-warning" />;
  if (status === "FLAKY") return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (status === "INFRA_ERROR") return <ServerCrash className="h-4 w-4 text-muted-foreground" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
}

const BADGE_VARIANTS: Record<ResultStatus, "success" | "destructive" | "secondary" | "warning" | "muted"> = {
  PASS: "success",
  FAIL: "destructive",
  BLOCKED: "secondary",
  SKIP: "warning",
  INFRA_ERROR: "muted",
  FLAKY: "warning",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = BADGE_VARIANTS[status as ResultStatus] ?? "warning";
  return (
    <span data-status={status}>
      <Badge variant={variant} title={STATUS_LABELS[status as ResultStatus]}>
        {status.replace("_", " ")}
      </Badge>
    </span>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
