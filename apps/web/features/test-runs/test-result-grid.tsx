"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TestRunResultRecord, TestRunSummary } from "@/features/hooks";
import { STATUS_FILTERS, Stat, StatusBadge, StatusIcon, passRate, type StatusFilter } from "./status";

function runPassRate(run: TestRunSummary): number {
  return passRate(run.passedCases, run.totalCases);
}

export function RunTotals({ run }: { run: TestRunSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Stat label="Total" value={run.totalCases} />
      <Stat label="Passed" value={run.passedCases} tone="text-emerald-600 dark:text-emerald-400" />
      <Stat label="Failed" value={run.failedCases} tone="text-red-600 dark:text-red-400" />
      <Stat label="Skipped" value={run.skippedCases} tone="text-amber-600 dark:text-amber-400" />
      <Stat label="Pass rate" value={`${runPassRate(run)}%`} />
    </div>
  );
}

export function TestResultGrid({ results }: { results: TestRunResultRecord[] }) {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [lightbox, setLightbox] = useState<TestRunResultRecord | null>(null);

  const visible = filter === "ALL" ? results : results.filter((row) => row.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((option) => (
          <Button key={option} size="sm" variant={filter === option ? "default" : "outline"} onClick={() => setFilter(option)}>
            {option}
            <span className="ml-1.5 tabular-nums opacity-70">
              {option === "ALL" ? results.length : results.filter((row) => row.status === option).length}
            </span>
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[60rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">TC ID</th>
              <th className="px-3 py-2">Test case</th>
              <th className="px-3 py-2">Test data</th>
              <th className="px-3 py-2">Expected result</th>
              <th className="px-3 py-2">Actual result</th>
              <th className="w-24 px-3 py-2">Status</th>
              <th className="w-28 px-3 py-2">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0 align-top">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.code}</td>
                <td className="px-3 py-2">
                  <div className="flex items-start gap-1.5">
                    <StatusIcon status={row.status} />
                    <span>
                      <span className="font-medium">{row.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">{row.type.toLowerCase()}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.testData ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{row.expectedResult ?? "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {row.error ? <span className="text-red-600 dark:text-red-400">{row.error}</span> : row.actualResult ?? "-"}
                  {row.durationMs !== null && (
                    <span className="ml-1.5 text-muted-foreground">({row.durationMs}ms)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-3 py-2">
                  {row.screenshotUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightbox(row)}
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
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No results match this filter.</div>
        )}
      </div>

      {lightbox?.screenshotUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="mb-3 flex shrink-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-xs text-white/70">{lightbox.code}</div>
              <div className="truncate font-semibold text-white">{lightbox.name}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setLightbox(null)}>
              Close
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <img
              src={lightbox.screenshotUrl}
              alt={lightbox.name}
              className="block h-auto w-full rounded border"
            />
          </div>
        </div>
      )}
    </div>
  );
}
