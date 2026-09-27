"use client";

import { useParams } from "next/navigation";
import { FileCode2, GitBranch, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useModuleDetail, useTestCases, useWorkflows, type TestCaseRecord, type WorkflowRecord } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { DiscoverModuleButton } from "@/features/discovery/discover-button";

export default function ModuleReviewPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;

  const { data: detail, isLoading } = useModuleDetail(moduleId);
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows(moduleId);
  const { data: testCases, isLoading: testsLoading } = useTestCases(moduleId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const module = detail?.module;
  if (!module) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Module not found.</div>;
  }

  const hasResult = (workflows?.length ?? 0) > 0 || (testCases?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleNav moduleId={moduleId} moduleName={module.name} status={module.discoveryStatus} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Review</h2>
          <p className="text-sm text-muted-foreground">
            Workflows and candidate test cases generated from the last discovery run. Execution arrives in Phase 3.
          </p>
        </div>
        {module.discoveryStatus !== "DISCOVERING" && <DiscoverModuleButton moduleId={moduleId} moduleName={module.name} />}
      </div>

      {!hasResult && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Nothing generated yet</AlertTitle>
          <AlertDescription>Run discovery to generate workflows and candidate test cases.</AlertDescription>
        </Alert>
      )}

      {hasResult && (
        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="tests">Test cases</TabsTrigger>
          </TabsList>
          <TabsContent value="workflows" className="mt-4">
            <WorkflowList workflows={workflows ?? []} loading={workflowsLoading} />
          </TabsContent>
          <TabsContent value="tests" className="mt-4">
            <TestCaseList testCases={testCases ?? []} loading={testsLoading} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function WorkflowList({ workflows, loading }: { workflows: WorkflowRecord[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (workflows.length === 0) return <Empty text="No workflows generated yet." />;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {workflows.map((workflow) => (
        <article key={workflow.id} className="rounded-xl border bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <GitBranch className="h-4 w-4 text-primary" />
              {workflow.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <Badge variant="muted">{workflow.source}</Badge>
              <Badge variant={workflow.confidence === "HIGH" ? "success" : workflow.confidence === "MEDIUM" ? "warning" : "muted"}>
                {workflow.confidence.toLowerCase()} confidence
              </Badge>
            </div>
          </div>
          {workflow.description && <p className="mb-2 text-sm text-muted-foreground">{workflow.description}</p>}
          {workflow.preconditions.length > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              <span className="font-medium">Precondition:</span> {workflow.preconditions.join(", ")}
            </p>
          )}
          <ol className="space-y-1">
            {workflow.steps.map((step) => (
              <li key={step.order} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {step.order}
                </span>
                <span className={step.optional ? "text-muted-foreground" : ""}>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">{step.action}</code>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{step.target}</span>
                  {step.value === undefined && null}
                  {step.value !== undefined && <span className="text-xs text-muted-foreground"> = “{step.value}”</span>}
                  {step.optional && <Badge variant="muted" className="ml-1">optional</Badge>}
                </span>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}

function TestCaseList({ testCases, loading }: { testCases: TestCaseRecord[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (testCases.length === 0) return <Empty text="No test cases generated yet." />;

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {testCases.map((test, index) => (
        <div key={test.id} className={`p-4 ${index % 2 === 0 ? "bg-muted/10" : ""} ${index !== testCases.length - 1 ? "border-b" : ""}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <FileCode2 className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs font-semibold text-muted-foreground">{test.code}</span>
            <h3 className="font-semibold">{test.name}</h3>
            <Badge variant={priorityVariant(test.priority)}>{test.priority.toLowerCase()} priority</Badge>
            <Badge variant="muted">{test.type}</Badge>
            {test.role && <Badge variant="info">{test.role}</Badge>}
            <Badge variant="success">{test.status.toLowerCase()}</Badge>
          </div>
          {test.description && <p className="mb-2 text-sm text-muted-foreground">{test.description}</p>}
          {test.precondition && (
            <p className="mb-2 text-xs text-muted-foreground">
              <span className="font-medium">Precondition:</span> {test.precondition}
            </p>
          )}
          <ol className="space-y-1">
            {test.steps.map((step) => (
              <li key={step.order} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {step.order}
                </span>
                <span>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">{step.action}</code>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{step.target}</span>
                  {step.value !== undefined && <span className="text-xs text-muted-foreground"> = “{step.value}”</span>}
                  {step.type === "assertion" && <Badge variant="info" className="ml-1">assertion</Badge>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function priorityVariant(priority: string): "destructive" | "warning" | "muted" {
  if (priority === "CRITICAL" || priority === "HIGH") return "destructive";
  if (priority === "MEDIUM") return "warning";
  return "muted";
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}