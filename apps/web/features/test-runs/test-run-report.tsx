"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestRunResultRecord, TestRunSummary } from "@/features/hooks";
import { Stat, StatusBadge, StatusIcon, passRate } from "./status";

interface Props {
  run: TestRunSummary;
  module: { name: string } | null;
  results: TestRunResultRecord[];
  onDownload?: () => void;
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

/**
 * Printable test-run report: one block per test case showing its stable code,
 * a full-size evidence screenshot, then the title and expected vs actual detail.
 */
export function TestRunReport({ run, module, results, onDownload }: Props) {
  const passed = results.filter((row) => row.status === "PASS").length;
  const failed = results.filter((row) => row.status === "FAIL").length;
  const blocked = results.filter((row) => row.status === "BLOCKED").length;
  const skipped = results.filter((row) => row.status === "SKIP").length;
  const withShot = results.filter((row) => row.screenshotUrl).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Test run report</h2>
          <p className="text-sm text-muted-foreground">
            {module?.name ?? "Module"} &middot; run <span className="font-mono text-xs">{run.id}</span>
          </p>
        </div>
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload} className="no-print">
            <Download className="mr-1.5 h-4 w-4" />
            Download JSON
          </Button>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Total" value={run.totalCases} />
        <Stat label="Passed" value={passed} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Failed" value={failed} tone="text-red-600 dark:text-red-400" />
        <Stat label="Blocked" value={blocked} tone="text-slate-600 dark:text-slate-300" />
        <Stat label="Skipped" value={skipped} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Pass rate" value={`${passRate(passed, results.length)}%`} />
        <Stat label="Evidence" value={`${withShot}/${results.length}`} />
      </section>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border bg-card p-4 text-sm sm:grid-cols-4">
        <Meta label="Status" value={run.status} />
        <Meta label="Started" value={fmtDate(run.startedAt)} />
        <Meta label="Finished" value={fmtDate(run.completedAt)} />
        <Meta label="Triggered by" value={run.triggeredBy ?? "system"} />
      </dl>

      {results.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          This run recorded no results.
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((row) => (
            <CaseReportBlock key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function CaseReportBlock({ row }: { row: TestRunResultRecord }) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card print:break-inside-avoid">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <StatusIcon status={row.status} />
        <span className="font-mono text-sm font-semibold tracking-tight">{row.code}</span>
        <StatusBadge status={row.status} />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{row.type.toLowerCase()}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{row.priority.toLowerCase()}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {row.durationMs !== null ? `${row.durationMs} ms` : "-"}
        </span>
      </header>

      {row.screenshotUrl && (
        <a
          href={row.screenshotUrl}
          target="_blank"
          rel="noreferrer"
          className="block border-b bg-muted/30 no-print"
          title="Open full size"
        >
          <img src={row.screenshotUrl} alt={`Evidence for ${row.code}`} className="block h-auto w-full" />
        </a>
      )}

      <div className="space-y-2 px-4 py-3">
        <h3 className="text-base font-semibold leading-snug">{row.name}</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Detail label="Test data" value={row.testData} mono />
          <Detail label="Expected" value={row.expectedResult} />
          <Detail label="Actual" value={row.error ?? row.actualResult} tone={row.error ? "error" : undefined} />
          <Detail
            label="Evidence"
            value={row.screenshotUrl ? row.screenshotKey ?? "captured" : "not captured"}
            tone={row.screenshotUrl ? undefined : "muted"}
          />
        </dl>
      </div>
    </article>
  );
}

function Detail({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  tone?: "error" | "muted";
}) {
  const toneClass = tone === "error" ? "text-red-600 dark:text-red-400" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`${mono ? "font-mono text-xs" : ""} ${toneClass} break-words`}>{value ?? "-"}</dd>
    </div>
  );
}
