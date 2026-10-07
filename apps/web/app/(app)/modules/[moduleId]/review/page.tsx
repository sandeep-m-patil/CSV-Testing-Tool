"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleDetail, useTestCases, useWorkflows, type TestCaseRecord } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { ModuleNotFound, ModulePageSkeleton } from "@/features/modules/module-page-states";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";
import { RunTestsButton } from "@/features/test-runs/run-tests-button";
import { ApproveAllDraftsButton } from "@/features/test-cases/case-review-actions";
import { TestCaseList } from "@/features/test-cases/test-case-list";
import { WorkflowList } from "@/features/test-cases/workflow-list";

export default function ModuleReviewPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;

  const { data: detail, isLoading } = useModuleDetail(moduleId);
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows(moduleId);
  const { data: testCases, isLoading: testsLoading } = useTestCases(moduleId);

  if (isLoading) {
    return (
      <ModulePageSkeleton>
        <Skeleton className="h-96 rounded-xl" />
      </ModulePageSkeleton>
    );
  }

  const module = detail?.module;
  if (!module) return <ModuleNotFound />;

  const hasResult = (workflows?.length ?? 0) > 0 || (testCases?.length ?? 0) > 0;
  const actions = (
    <>
      {module.discoveryStatus !== "DISCOVERING" && <DiscoverModuleButton moduleId={moduleId} moduleName={module.name} />}
      <RunTestsButton moduleId={moduleId} moduleName={module.name} caseCount={testCases?.length ?? 0} />
    </>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleNav
        moduleId={moduleId}
        moduleName={module.name}
        status={module.discoveryStatus}
        project={detail?.project ? { id: detail.project.id, name: detail.project.name } : null}
        actions={actions}
      />

      <p className="text-sm text-muted-foreground">
        Workflows and test cases generated from the last discovery run. Run them from the Test runs tab.
      </p>

      {!hasResult && (
        <EmptyState
          icon={<ListChecks />}
          title="Nothing generated yet"
          description="Run discovery to generate workflows and candidate test cases."
        />
      )}

      {hasResult && (
        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows">
              Workflows
              <span className="text-xs tabular-nums text-muted-foreground">{workflows?.length ?? 0}</span>
            </TabsTrigger>
            <TabsTrigger value="tests">
              Test cases
              <span className="text-xs tabular-nums text-muted-foreground">{testCases?.length ?? 0}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="workflows" className="mt-4">
            <WorkflowList workflows={workflows ?? []} loading={workflowsLoading} />
          </TabsContent>
          <TabsContent value="tests" className="mt-4 space-y-4">
            {(testCases?.length ?? 0) > 0 && (
              <RunPolicyBar moduleId={moduleId} testCases={testCases!} requireApproval={module.requireApproval} />
            )}
            <TestCaseList moduleId={moduleId} testCases={testCases ?? []} loading={testsLoading} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** Mirrors the executor's gate: rejected never runs; with approval required, only reviewed cases do. */
function runnableCount(testCases: TestCaseRecord[], requireApproval: boolean): number {
  return testCases.filter((test) => test.status !== "REJECTED" && (!requireApproval || test.status === "APPROVED" || test.status === "READY")).length;
}

interface RunPolicyBarProps {
  moduleId: string;
  testCases: TestCaseRecord[];
  requireApproval: boolean;
}

function RunPolicyBar({ moduleId, testCases, requireApproval }: RunPolicyBarProps) {
  const runnable = runnableCount(testCases, requireApproval);
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">{runnable}</span> of{" "}
        <span className="tabular-nums">{testCases.length}</span> case{testCases.length === 1 ? "" : "s"} will run
        {requireApproval ? " (approval required)" : " (rejected cases are skipped)"}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ApproveAllDraftsButton moduleId={moduleId} draftCount={testCases.filter((test) => test.status === "DRAFT").length} />
        <Link
          href={`/modules/${moduleId}/test-runs`}
          className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View results
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
