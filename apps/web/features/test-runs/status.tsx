"use client";

import { CheckCircle2, CircleSlash, HelpCircle, MinusCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const STATUS_FILTERS = ["ALL", "PASS", "FAIL", "BLOCKED", "SKIP"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type ResultStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIP";

export function passRate(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
}

export function StatusIcon({ status }: { status: string }) {
  if (status === "PASS") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "FAIL") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "BLOCKED") return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  if (status === "SKIP") return <CircleSlash className="h-4 w-4 text-warning" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "PASS" ? "success" : status === "FAIL" ? "destructive" : status === "BLOCKED" ? "secondary" : "warning";
  return (
    <span data-status={status}>
      <Badge variant={variant}>{status}</Badge>
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
