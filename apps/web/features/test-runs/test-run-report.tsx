"use client";

import { FileJson, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestRunResultRecord, TestRunSummary } from "@/features/hooks";
import { Stat, StatusBadge, StatusIcon, passRate } from "./status";
import { CaseSteps } from "./case-steps";
import { RunMeta } from "./test-result-grid";

interface Props {
  run: TestRunSummary;
  module: { name: string } | null;
  results: TestRunResultRecord[];
  onDownloadJson?: () => void;
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

/**
 * Printable test-run report: one block per test case showing its stable code,
 * a full-size evidence screenshot, then the title and expected vs actual detail.
 * "Print / Save as PDF" uses the browser's own PDF engine, so screenshots stay
 * full quality and the text stays selectable.
 */
export function TestRunReport({ run, module, results, onDownloadJson }: Props) {
  const passed = results.filter((row) => row.status === "PASS").length;
  const failed = results.filter((row) => row.status === "FAIL").length;
  const blocked = results.filter((row) => row.status === "BLOCKED").length;
  const skipped = results.filter((row) => row.status === "SKIP").length;
  const withShot = results.filter((row) => row.screenshotUrl).length;

  return (
    <div className="print-report space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Test run report</h2>
          <p className="text-sm text-muted-foreground">
            {module?.name ?? "Module"} &middot; <span className="font-mono text-xs">{run.runLabel}</span>
          </p>
        </div>
        <div className="flex gap-2 no-print">
          {onDownloadJson && (
            <Button variant="outline" size="sm" onClick={onDownloadJson}>
              <FileJson className="mr-1.5 h-4 w-4" />
              JSON
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Total" value={run.totalCases} />
        <Stat label="Passed" value={passed} tone="text-success" />
        <Stat label="Failed" value={failed} tone="text-destructive" />
        <Stat label="Blocked" value={blocked} tone="text-muted-foreground" />
        <Stat label="Skipped" value={skipped} tone="text-warning" />
        <Stat label="Pass rate" value={`${passRate(passed, results.length)}%`} />
        <Stat label="Evidence" value={`${withShot}/${results.length}`} />
      </section>

      <RunMeta run={run} />

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
    <article className="print-card print-block overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <StatusIcon status={row.status} />
        <span className="font-mono text-sm font-semibold tracking-tight">{row.code}</span>
        {row.datasetRow !== null && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            row {row.datasetRow + 1}
          </span>
        )}
        <StatusBadge status={row.status} />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{row.type.toLowerCase()}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{row.priority.toLowerCase()}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {row.durationMs !== null ? `${row.durationMs} ms` : "-"}
        </span>
      </header>

      <div className="space-y-2 px-4 py-3">
        <h3 className="text-base font-semibold leading-snug">{row.name}</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <Detail label="Role" value={row.role ?? "default credential"} />
          <Detail label="Credential" value={row.credentialName ?? "none"} />
          <Detail label="Attempts" value={String(row.attemptCount)} />
          <Detail label="Test data" value={row.testData} mono />
          <Detail label="Expected" value={row.expectedResult} />
          <Detail label="Actual" value={row.error ?? row.actualResult} tone={row.error ? "error" : undefined} />
        </dl>
      </div>

      <div className="border-t px-4 py-3">
        {row.stepResults.length > 0 ? (
          <CaseSteps steps={row.stepResults} attempts={row.attempts} onOpenImage={(url) => window.open(url, "_blank", "noreferrer")} />
        ) : row.screenshotUrl ? (
          <a href={row.screenshotUrl} target="_blank" rel="noreferrer" className="print-evidence block" title="Open full size">
            <img src={row.screenshotUrl} alt={`Evidence for ${row.code}`} className="block h-auto w-full rounded border" />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">No screenshot captured.</p>
        )}
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
  const toneClass = tone === "error" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`${mono ? "font-mono text-xs" : ""} ${toneClass} break-words`}>{value ?? "-"}</dd>
    </div>
  );
}
