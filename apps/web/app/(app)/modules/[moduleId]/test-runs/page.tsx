"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleDetail, useTestRun, useTestRuns, type TestRunSummary } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { RunTestsButton } from "@/features/test-runs/run-tests-button";
import { RunTotals, TestResultGrid } from "@/features/test-runs/test-result-grid";

function runStatusLabel(run: TestRunSummary): string {
  if (run.status === "QUEUED") return "Queued - waiting for the worker to pick it up";
  if (run.status === "RUNNING") return "Running test cases";
  if (run.status === "COMPLETED") return `Completed - ${run.passedCases}/${run.totalCases} passed`;
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
  const moduleId = params.moduleId;
  const requestedRun = search.get("run");

  const { data: detail, isLoading } = useModuleDetail(moduleId);
  const { data: runs } = useTestRuns(moduleId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(requestedRun);
  const activeRunId = selectedRunId ?? runs?.[0]?.id ?? null;
  const { data: runData, isLoading: runLoading } = useTestRun(activeRunId);

  if (isLoading) return <Skeleton className="mx-auto my-6 h-96 max-w-6xl rounded-xl" />;

  const module = detail?.module;
  if (!module) return <div className="py-20 text-center text-sm text-muted-foreground">Module not found.</div>;

  const caseCount = runData?.results.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ModuleNav moduleId={moduleId} moduleName={module.name} status={module.discoveryStatus} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Test runs</h2>
          <p className="text-sm text-muted-foreground">
            Execute the generated test cases against the live app and review pass/fail with screenshot evidence.
          </p>
        </div>
        <RunTestsButton moduleId={moduleId} moduleName={module.name} caseCount={latestCaseCount(runs)} />
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
        <Tabs value={activeRunId ?? undefined} onValueChange={setSelectedRunId}>
          <TabsList className="flex-wrap">
            {runs!.map((run) => (
              <TabsTrigger key={run.id} value={run.id}>
                {run.status === "COMPLETED" ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : null}
                {run.status === "FAILED" ? <XCircle className="mr-1.5 h-3.5 w-3.5 text-red-500" /> : null}
                {run.status === "RUNNING" || run.status === "QUEUED" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {new Date(run.createdAt).toLocaleString()}
              </TabsTrigger>
            ))}
          </TabsList>

          {runs!.map((run) => (
            <TabsContent key={run.id} value={run.id} className="mt-4 space-y-4">
              {runLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : runData && runData.testRun.id === run.id ? (
                <>
                  <p className="text-sm text-muted-foreground">{runStatusLabel(runData.testRun)}</p>
                  <RunTotals run={runData.testRun} />
                  {caseCount === 0 ? (
                    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      This module has no test cases. Run discovery to generate them.
                    </p>
                  ) : (
                    <TestResultGrid results={runData.results} />
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
