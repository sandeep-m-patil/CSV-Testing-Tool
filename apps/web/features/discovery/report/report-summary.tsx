"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, titleCase } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  COMPLETED: "success",
  RUNNING: "warning",
  FAILED: "destructive",
  CANCELLED: "muted",
  QUEUED: "muted",
};

export type ReportSummaryData = {
  session: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  };
  module: { name: string; description: string | null; startPath: string | null; includePaths: string[] } | null;
  project: { name: string; baseUrl: string; environment: string } | null;
  counts: Array<{ label: string; value: number }>;
  workflowsCount: number;
};

export function ReportSummary({ data }: { data: ReportSummaryData }) {
  const duration = durationLabel(data.session.startedAt, data.session.completedAt);
  const scope = [data.module?.startPath, ...(data.module?.includePaths ?? [])].filter(
    (path): path is string => Boolean(path),
  );

  return (
    <Card className="print-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Discovery report</CardTitle>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {data.project?.name} &middot; {data.project?.baseUrl} &middot; {data.project?.environment}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[data.session.status] ?? "muted"} data-status={data.session.status}>
            {data.session.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Field label="Module" value={data.module?.name ?? "—"} />
          <Field label="Generated" value={formatDate(new Date().toISOString())} />
          <Field label="Started" value={formatDate(data.session.startedAt)} />
          <Field label="Duration" value={duration} />
        </dl>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Module scope</p>
          <p className="mt-1 text-sm">
            {scope.length === 0 ? "Whole site (no start path configured)" : scope.join("  ·  ")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.counts.map((count) => (
            <div key={count.label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-2xl font-semibold tabular-nums">{count.value}</p>
              <p className="text-xs text-muted-foreground">{count.label}</p>
            </div>
          ))}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-2xl font-semibold tabular-nums">{data.workflowsCount}</p>
            <p className="text-xs text-muted-foreground">Workflows</p>
          </div>
        </div>

        {data.session.error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Run error: {data.session.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function durationLabel(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function pageTypeLabel(pageType: string): string {
  return titleCase(pageType);
}
