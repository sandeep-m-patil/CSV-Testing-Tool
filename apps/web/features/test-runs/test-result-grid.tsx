"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TestRunResultRecord, TestRunSummary } from "@/features/hooks";
import { CaseSteps } from "./case-steps";
import { Pagination, usePagination } from "./pagination";
import { ScreenshotLightbox, type LightboxImage } from "./screenshot-lightbox";
import { STATUS_FILTERS, Stat, StatusBadge, StatusIcon, passRate, type StatusFilter } from "./status";

const STICKY_TH = "sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur";
const COLUMN_COUNT = 8;

export function RunTotals({ run }: { run: TestRunSummary }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Stat label="Total" value={run.totalCases} />
        <Stat label="Passed" value={run.passedCases} tone="text-success" />
        <Stat label="Failed" value={run.failedCases} tone="text-destructive" />
        <Stat label="Blocked" value={run.blockedCases} tone="text-muted-foreground" />
        <Stat label="Skipped" value={run.skippedCases} tone="text-warning" />
        <Stat label="Pass rate" value={`${passRate(run.passedCases, run.totalCases)}%`} />
      </div>
      <RunMeta run={run} />
    </div>
  );
}

/** One line of run configuration so a result can always be reproduced. */
export function RunMeta({ run }: { run: TestRunSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Badge variant="outline" className="font-mono">{run.runLabel}</Badge>
      <Badge variant="muted">{run.browser}</Badge>
      <Badge variant="muted">{run.workers} worker{run.workers === 1 ? "" : "s"}</Badge>
      <Badge variant="muted">{run.retries} retr{run.retries === 1 ? "y" : "ies"}</Badge>
      {run.failFast && <Badge variant="warning">fail-fast</Badge>}
      {run.parentRunLabel && <Badge variant="info">rerun of {run.parentRunLabel}</Badge>}
      {run.baseUrl && <span className="truncate font-mono">{run.baseUrl}</span>}
      {run.durationMs !== null && <span className="tabular-nums">· {(run.durationMs / 1000).toFixed(1)} s</span>}
    </div>
  );
}

export function TestResultGrid({ results }: { results: TestRunResultRecord[] }) {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  const filtered = filter === "ALL" ? results : results.filter((row) => row.status === filter);
  const pager = usePagination(filtered);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((option) => (
          <Button key={option} size="sm" variant={filter === option ? "default" : "outline"} onClick={() => setFilter(option)}>
            {option}
            <span className="ml-1.5 tabular-nums opacity-70">{option === "ALL" ? results.length : results.filter((row) => row.status === option).length}</span>
          </Button>
        ))}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className={`${STICKY_TH} w-8`} aria-label="Expand" />
              <th className={STICKY_TH}>TC ID</th>
              <th className={STICKY_TH}>Test case</th>
              <th className={STICKY_TH}>Test data</th>
              <th className={STICKY_TH}>Expected result</th>
              <th className={STICKY_TH}>Actual result</th>
              <th className={`${STICKY_TH} w-24`}>Status</th>
              <th className={`${STICKY_TH} w-28`}>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {pager.visible.map((row) => (
              <Fragment key={row.id}>
                <ResultRow row={row} isExpanded={expanded === row.id} onToggle={() => setExpanded(expanded === row.id ? null : row.id)} onOpenImage={setLightbox} />
                {expanded === row.id && (
                  <tr className="border-b bg-muted/10">
                    <td colSpan={COLUMN_COUNT} className="p-3">
                      <CaseSteps steps={row.stepResults} attempts={row.attempts} onOpenImage={(url, title) => setLightbox({ url, title })} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {pager.visible.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No results match this filter.</div>}
      </div>

      <Pagination {...pager} />
      <ScreenshotLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

interface RowProps {
  row: TestRunResultRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenImage: (image: LightboxImage) => void;
}

function ResultRow({ row, isExpanded, onToggle, onOpenImage }: RowProps) {
  return (
    <tr className="cursor-pointer border-b align-top last:border-b-0 hover:bg-muted/20" onClick={onToggle}>
      <td className="px-2 py-2 text-muted-foreground">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.code}</td>
      <td className="px-3 py-2">
        <div className="flex items-start gap-1.5">
          <StatusIcon status={row.status} />
          <span>
            <span className="font-medium">{row.name}</span>
            {row.datasetRow !== null && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">row {row.datasetRow + 1}</span>}
            {row.role && <Badge variant="info" className="ml-1.5 px-1.5 py-0 text-[10px]">{row.role}</Badge>}
            {row.attemptCount > 1 && <Badge variant="warning" className="ml-1.5 px-1.5 py-0 text-[10px]">{row.attemptCount} attempts</Badge>}
            <span className="ml-1.5 text-xs text-muted-foreground">{row.type.toLowerCase()}</span>
          </span>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.testData ?? "-"}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{row.expectedResult ?? "-"}</td>
      <td className="px-3 py-2 text-xs">
        {row.error ? <span className="text-destructive">{row.error}</span> : (row.actualResult ?? "-")}
        {row.durationMs !== null && <span className="ml-1.5 text-muted-foreground">({row.durationMs}ms)</span>}
      </td>
      <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
      <td className="px-3 py-2">
        {row.screenshotUrl ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenImage({ url: row.screenshotUrl!, title: `${row.code} ${row.name}` });
            }}
            className="overflow-hidden rounded border transition hover:opacity-80"
            aria-label="View screenshot"
          >
            <img src={row.screenshotUrl} alt={`Screenshot for ${row.name}`} className="h-10 w-16 object-cover" />
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">none</span>
        )}
      </td>
    </tr>
  );
}
