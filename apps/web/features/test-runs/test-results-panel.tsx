"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ModuleReport, ModuleReportRun } from "@/features/hooks";
import { Stat, passRate } from "./status";

interface Props {
  moduleId: string;
  report: ModuleReport["report"];
}

/** Module-level test execution aggregation, computed from stored run results. */
export function TestResultsPanel({ moduleId, report }: Props) {
  const { testSummary: summary, coverage, testRuns: runs } = report;
  const drifted = runs.filter((run) => !run.countersConsistent);

  if (runs.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Test results</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No test runs recorded for this module yet. Run the generated test cases to populate this report.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Test results</h2>
        <span className="text-xs text-muted-foreground">across {summary.runs} run(s)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Executed" value={summary.executed} />
        <Stat label="Passed" value={summary.passed} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Failed" value={summary.failed} tone="text-red-600 dark:text-red-400" />
        <Stat label="Blocked" value={summary.blocked} tone="text-slate-600 dark:text-slate-300" />
        <Stat label="Skipped" value={summary.skipped} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Pass rate" value={`${passRate(summary.passed, summary.executed)}%`} />
        <Stat label="Evidence" value={summary.screenshots} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cases created" value={coverage.testCasesCreated} />
        <Stat label="Cases executed" value={coverage.testCasesExecuted} />
        <Stat label="Never executed" value={coverage.untestedTestCases} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Pages found" value={coverage.pagesDiscovered} />
      </div>

      {drifted.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            Stored totals disagree with the per-result rows for {drifted.length} run(s). The numbers below are
            recalculated from the individual results, so they are authoritative.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Run</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Pass</th>
              <th className="px-3 py-2 text-right">Fail</th>
              <th className="px-3 py-2 text-right">Skip</th>
              <th className="px-3 py-2 text-right">Shots</th>
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <RunRow key={run.id} moduleId={moduleId} run={run} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RunRow({ moduleId, run }: { moduleId: string; run: ModuleReportRun }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2">
        <div className="font-mono text-xs">{run.id.slice(0, 8)}</div>
        <div className="text-xs text-muted-foreground">{fmt(run.startedAt)}</div>
        {run.error && <div className="text-xs text-red-600 dark:text-red-400">{run.error}</div>}
      </td>
      <td className="px-3 py-2">
        <Badge variant={run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "destructive" : "secondary"}>
          {run.status}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{run.executed}</td>
      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{run.passed}</td>
      <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{run.failed}</td>
      <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{run.skipped}</td>
      <td className="px-3 py-2 text-right tabular-nums">{run.screenshots}</td>
      <td className="px-3 py-2">
        <Link
          href={`/modules/${moduleId}/test-runs?run=${run.id}`}
          className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}

function fmt(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}
