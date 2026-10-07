"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { TestRunSummary } from "@/features/hooks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "./format";
import { passRate } from "./status";

type ProjectRun = TestRunSummary & { moduleName: string };

const ACTIVE = ["QUEUED", "RUNNING"];
export const projectRunsKey = (projectId: string) => ["projects", projectId, "test-runs"] as const;

function useProjectRuns(projectId: string) {
  return useQuery({
    queryKey: projectRunsKey(projectId),
    queryFn: () => apiFetch<{ runs: ProjectRun[] }>(`/api/projects/${projectId}/test-runs`),
    select: (data) => data.runs,
    refetchInterval: (query) => ((query.state.data as { runs?: ProjectRun[] } | undefined)?.runs?.some((run) => ACTIVE.includes(run.status)) ? 3000 : false),
  });
}

/** Cross-module run history for the project: every run is kept and linkable. */
export function ProjectRunsCard({ projectId }: { projectId: string }) {
  const { data: runs, isLoading } = useProjectRuns(projectId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Recent test runs
        </CardTitle>
        <CardDescription>Across every module of this project, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-24 rounded-lg" />}
        {runs?.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
        {runs && runs.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {runs.slice(0, 10).map((run) => (
              <li key={run.id}>
                <Link href={`/modules/${run.moduleId}/test-runs?run=${run.id}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                  <span className="font-mono text-xs">{run.runLabel}</span>
                  <span className="font-medium">{run.moduleName}</span>
                  <Badge variant={run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "destructive" : "muted"}>{run.status.toLowerCase()}</Badge>
                  {run.scope === "failed" && <Badge variant="info">rerun</Badge>}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {run.passedCases}/{run.totalCases} passed · {run.failedCases} failed · {run.blockedCases} blocked · {passRate(run.passedCases, run.totalCases)}%
                  </span>
                  <span className="w-full text-xs text-muted-foreground sm:w-auto">{formatDateTime(run.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
