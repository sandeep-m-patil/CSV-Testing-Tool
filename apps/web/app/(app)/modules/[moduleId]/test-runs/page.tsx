"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleDetail, useTestCases, useTestRun, useTestRuns, type TestRunSummary } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { DeleteTestRunButton } from "@/features/test-runs/delete-test-run-button";
import { formatDateTime } from "@/features/test-runs/format";
import { RunTestsButton } from "@/features/test-runs/run-tests-button";
import { RerunFailedButton } from "@/features/test-runs/rerun-failed-button";
import { RunTotals, TestResultGrid } from "@/features/test-runs/test-result-grid";
import { TestRunReport } from "@/features/test-runs/test-run-report";

type ViewMode = "grid" | "report";

function pathnameFor(moduleId: string): string {
  return `/modules/${moduleId}/test-runs`;
}

function runStatusLabel(run: TestRunSummary): string {
  if (run.status === "QUEUED") return "Queued - waiting for the worker to pick it up";
  if (run.status === "RUNNING") return "Running test cases";
  if (run.status === "COMPLETED") {
    const blocked = run.blockedCases > 0 ? `, ${run.blockedCases} blocked` : "";
    return `Completed - ${run.passedCases}/${run.totalCases} passed, ${run.failedCases} failed${blocked}${run.error ? ` (${run.error})` : ""}`;
  }
  return `Failed: ${run.error ?? "unknown error"}`;
}

export default function ModuleTestRunsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-6 h-96 max-w-6xl rounded-xl" />}>
      <TestRunsView />
    </Suspense>
  );
}

function TestRunsView() {
  const params = useParams<{ moduleId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const moduleId = params.moduleId;
  const requestedRun = search.get("run");

  const { data: detail, isLoading } = useModuleDetail(moduleId);
  const { data: runs } = useTestRuns(moduleId);
  const { data: testCases } = useTestCases(moduleId);
  const [view, setView] = useState<ViewMode>("grid");

  // The active run lives in the URL so a reload, share or back/forward keeps
  // the same run selected.
  const activeRunId = requestedRun ?? runs?.[0]?.id ?? null;
  const { data: runData, isLoading: runLoading } = useTestRun(activeRunId);

  useEffect(() => {
    if (requestedRun || !activeRunId) return;
    const next = new URLSearchParams(search.toString());
    next.set("run", activeRunId);
    router.replace(`${pathnameFor(moduleId)}?${next.toString()}`, { scroll: false });
  }, [requestedRun, activeRunId, moduleId, router, search]);

  const selectRun = useCallback(
    (runId: string) => {
      const next = new URLSearchParams(search.toString());
      next.set("run", runId);
      router.replace(`${pathnameFor(moduleId)}?${next.toString()}`, { scroll: false });
    },
    [moduleId, router, search],
  );

  const onRunDeleted = useCallback(() => {
    // Drop the ?run= param so the view falls back to the newest remaining run.
    const next = new URLSearchParams(search.toString());
    next.delete("run");
    router.replace(`${pathnameFor(moduleId)}${next.size > 0 ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [moduleId, router, search]);

  if (isLoading) return <Skeleton className="mx-auto my-6 h-96 max-w-6xl rounded-xl" />;

  const module = detail?.module;
  if (!module) return <div className="py-20 text-center text-sm text-muted-foreground">Module not found.</div>;

  const caseCount = runData?.results.length ?? 0;
  const knownCaseCount = testCases?.length ?? latestCaseCount(runs);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ModuleNav moduleId={moduleId} moduleName={module.name} status={module.discoveryStatus} />

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Test runs</h2>
          <p className="text-sm text-muted-foreground">
            Execute the generated test cases against the live app and review pass/fail with screenshot evidence.
          </p>
        </div>
        <RunTestsButton moduleId={moduleId} moduleName={module.name} caseCount={knownCaseCount} />
      </div>

      {(runs?.length ?? 0) === 0 && (
        <Alert>
          <Loader2 className="h-4 w-4" />
          <AlertTitle>No test runs yet</AlertTitle>
          <AlertDescription>
            Discovery generates the test cases. Once a run exists, totals, pass rate and per-case screenshots appear
            here.
          </AlertDescription>
        </Alert>
      )}

      {(runs?.length ?? 0) > 0 && (
        <Tabs value={activeRunId ?? undefined} onValueChange={selectRun}>
          <TabsList className="no-print flex-wrap">
            {runs!.map((run) => (
              <div key={run.id} className="group/run relative inline-flex items-center">
                <TabsTrigger value={run.id} className="pr-8">
                  {run.status === "COMPLETED" ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : null}
                  {run.status === "FAILED" ? <XCircle className="mr-1.5 h-3.5 w-3.5 text-red-500" /> : null}
                  {run.status === "RUNNING" || run.status === "QUEUED" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  <span className="font-mono text-xs">{run.runLabel}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</span>
                </TabsTrigger>
                <DeleteTestRunButton
                  testRunId={run.id}
                  moduleId={moduleId}
                  runDate={run.createdAt}
                  onDeleted={onRunDeleted}
                  className="absolute right-1 h-6 w-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/run:opacity-100 data-[state=active]:opacity-100"
                />
              </div>
            ))}
          </TabsList>

          {runs!.map((run) => (
            <TabsContent key={run.id} value={run.id} className="mt-4 space-y-4">
              {runLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : runData && runData.testRun.id === run.id ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{runStatusLabel(runData.testRun)}</p>
                    <div className="flex gap-1 no-print">
                      {runData.testRun.status === "COMPLETED" && (
                        <RerunFailedButton
                          moduleId={moduleId}
                          testRunId={runData.testRun.id}
                          failedCount={runData.results.filter((result) => result.status === "FAIL" || result.status === "BLOCKED").length}
                        />
                      )}
                      <Button size="sm" variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}>
                        Grid
                      </Button>
                      <Button
                        size="sm"
                        variant={view === "report" ? "default" : "outline"}
                        onClick={() => setView("report")}
                      >
                        Report
                      </Button>
                    </div>
                  </div>
                  {view === "report" ? (
                    <TestRunReport
                      run={runData.testRun}
                      module={runData.module}
                      results={runData.results}
                      onDownloadJson={() => downloadRunReport(runData)}
                    />
                  ) : (
                    <>
                      <RunTotals run={runData.testRun} />
                      {caseCount === 0 ? (
                        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                          This module has no test cases. Run discovery to generate them.
                        </p>
                      ) : (
                        <TestResultGrid results={runData.results} />
                      )}
                    </>
                  )}
                </>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

/** Case count for the newest run, falling back to a non-zero hint. */
function latestCaseCount(runs: TestRunSummary[] | undefined): number {
  const withResults = runs?.find((run) => run.totalCases > 0);
  return withResults?.totalCases ?? 0;
}

/** Save the run detail as a JSON report file for sharing or archiving. */
function downloadRunReport(data: { testRun: TestRunSummary; module: { name: string } | null; results: unknown[] }): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${data.testRun.runLabel ?? `test-run-${data.testRun.id}`}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
