import { FileCode2, Sparkles } from "lucide-react";
import type { TestCaseRecord } from "@/features/hooks";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CaseReviewActions } from "./case-review-actions";
import { StepList } from "./step-list";

function priorityVariant(priority: string): "destructive" | "warning" | "muted" {
  if (priority === "CRITICAL" || priority === "HIGH") return "destructive";
  if (priority === "MEDIUM") return "warning";
  return "muted";
}

interface TestCaseListProps {
  moduleId: string;
  testCases: TestCaseRecord[];
  loading: boolean;
}

/** Candidate test cases with metadata badges, review actions and their steps. */
export function TestCaseList({ moduleId, testCases, loading }: TestCaseListProps) {
  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (testCases.length === 0) {
    return <EmptyState size="compact" icon={<FileCode2 />} title="No test cases generated yet" />;
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {testCases.map((test) => (
        <li key={test.id} className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-xs font-semibold text-muted-foreground">{test.code}</span>
                <h3 className="min-w-0 break-words font-semibold tracking-tight">{test.name}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={priorityVariant(test.priority)}>{test.priority.toLowerCase()} priority</Badge>
                <Badge variant="muted">{test.type}</Badge>
                {test.role && <Badge variant="info">{test.role}</Badge>}
                {test.source === "ai" && (
                  <Badge variant="brand">
                    <Sparkles aria-hidden="true" />
                    AI
                  </Badge>
                )}
              </div>
            </div>
            <CaseReviewActions moduleId={moduleId} testId={test.id} status={test.status} />
          </div>
          {test.description && <p className="mt-3 text-sm text-muted-foreground">{test.description}</p>}
          {test.precondition && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Precondition:</span> {test.precondition}
            </p>
          )}
          <div className="mt-3 rounded-lg border bg-background/40 p-3">
            <StepList steps={test.steps} />
          </div>
        </li>
      ))}
    </ul>
  );
}
