import { GitBranch } from "lucide-react";
import type { WorkflowRecord } from "@/features/hooks";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StepList } from "./step-list";

function confidenceVariant(confidence: string): "success" | "warning" | "muted" {
  if (confidence === "HIGH") return "success";
  if (confidence === "MEDIUM") return "warning";
  return "muted";
}

/** Generated workflows as cards with source, confidence, preconditions and steps. */
export function WorkflowList({ workflows, loading }: { workflows: WorkflowRecord[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (workflows.length === 0) {
    return <EmptyState size="compact" icon={<GitBranch />} title="No workflows generated yet" />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {workflows.map((workflow) => (
        <article key={workflow.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm shadow-black/20">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
              <GitBranch className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 break-words">{workflow.name}</span>
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="muted">{workflow.source}</Badge>
              <Badge variant={confidenceVariant(workflow.confidence)}>{workflow.confidence.toLowerCase()} confidence</Badge>
            </div>
          </div>
          {workflow.description && <p className="mt-2 text-sm text-muted-foreground">{workflow.description}</p>}
          {workflow.preconditions.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Precondition:</span> {workflow.preconditions.join(", ")}
            </p>
          )}
          <div className="mt-4 border-t pt-4">
            <StepList steps={workflow.steps} />
          </div>
        </article>
      ))}
    </div>
  );
}
